import { createPrivateKey, createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { AppStoreConnectSetupConfiguration } from '@shared/contracts/domain';

const createToken = async (
  configuration: AppStoreConnectSetupConfiguration,
): Promise<string> => {
  const issuedAt = Math.floor(Date.now() / 1_000);
  const header = Buffer.from(JSON.stringify({
    alg: 'ES256',
    kid: configuration.apiKeyId,
    typ: 'JWT',
  })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    aud: 'appstoreconnect-v1',
    exp: issuedAt + 20 * 60,
    iat: issuedAt,
    iss: configuration.issuerId,
  })).toString('base64url');
  const signer = createSign('SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  const privateKey = createPrivateKey(await readFile(configuration.apiKeyPath, 'utf8'));
  const signature = signer.sign({ dsaEncoding: 'ieee-p1363', key: privateKey }).toString('base64url');
  return `${header}.${payload}.${signature}`;
};

export class AppStoreConnectIntegration {
  public async validateAccess(
    configuration: AppStoreConnectSetupConfiguration,
    signal: AbortSignal,
  ): Promise<void> {
    const response = await fetch('https://api.appstoreconnect.apple.com/v1/apps?limit=1', {
      headers: { authorization: `Bearer ${await createToken(configuration)}` },
      signal,
    });
    if (!response.ok) {
      throw new Error(`App Store Connect API credentials could not be validated (${response.status}).`);
    }
  }
}
