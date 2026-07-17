import { createSign } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile } from 'node:fs/promises';
import https from 'node:https';
import type { GooglePlaySetupConfiguration } from '@shared/contracts/domain';
import { isRecord } from '@main/utils/FileSystem';

const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const TOKEN_AUDIENCE = 'https://oauth2.googleapis.com/token';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

type ServiceAccount = {
  clientEmail: string;
  privateKey: string;
};

type PlayRelease = {
  name: string;
  releaseNotes: Array<{ language: string; text: string }>;
  status: GooglePlaySetupConfiguration['promotionStatus'];
  userFraction?: number;
  versionCodes: string[];
};

export type GooglePlayUploadOptions = {
  artifactPath: string;
  configuration: GooglePlaySetupConfiguration;
  releaseName: string;
  releaseNotes: string;
  signal: AbortSignal;
};

const encodeBase64Url = (value: string | Buffer): string =>
  Buffer.from(value).toString('base64url');

const readServiceAccount = async (filePath: string): Promise<ServiceAccount> => {
  const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
  if (
    !isRecord(parsed) ||
    typeof parsed.client_email !== 'string' ||
    typeof parsed.private_key !== 'string' ||
    parsed.client_email.trim() === '' ||
    parsed.private_key.trim() === ''
  ) {
    throw new Error('The Google Play service account JSON is invalid.');
  }
  return { clientEmail: parsed.client_email, privateKey: parsed.private_key };
};

const createAccessToken = async (
  serviceAccount: ServiceAccount,
  signal: AbortSignal,
): Promise<string> => {
  const issuedAt = Math.floor(Date.now() / 1_000);
  const header = encodeBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = encodeBase64Url(JSON.stringify({
    aud: TOKEN_AUDIENCE,
    exp: issuedAt + 3_600,
    iat: issuedAt,
    iss: serviceAccount.clientEmail,
    scope: ANDROID_PUBLISHER_SCOPE,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  signer.end();
  const assertion = `${header}.${claim}.${signer.sign(serviceAccount.privateKey).toString('base64url')}`;
  const response = await fetch(TOKEN_AUDIENCE, {
    body: new URLSearchParams({
      assertion,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
    signal,
  });
  const payload: unknown = await response.json();
  if (!response.ok || !isRecord(payload) || typeof payload.access_token !== 'string') {
    throw new Error('Google Play service account authentication failed.');
  }
  return payload.access_token;
};

const requestJson = async (
  url: string,
  accessToken: string,
  signal: AbortSignal,
  method: 'DELETE' | 'POST' | 'PUT',
  body?: unknown,
): Promise<unknown> => {
  const response = await fetch(url, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    method,
    signal,
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Google Play API request failed (${response.status}). ${responseText.slice(0, 800)}`);
  }
  return responseText === '' ? null : JSON.parse(responseText);
};

const uploadArtifact = async (
  url: string,
  accessToken: string,
  artifactPath: string,
  contentType: string,
  signal: AbortSignal,
): Promise<unknown> => {
  const artifactStats = await lstat(artifactPath);
  return await new Promise((resolve, reject) => {
    const request = https.request(url, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-length': artifactStats.size,
        'content-type': contentType,
      },
      method: 'POST',
    });
    let responseBody = '';
    const handleAbort = (): void => {
      request.destroy(new Error('The operation was cancelled.'));
    };
    signal.addEventListener('abort', handleAbort, { once: true });
    request.once('error', (error) => {
      signal.removeEventListener('abort', handleAbort);
      reject(error);
    });
    request.once('response', (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        if (responseBody.length < MAX_RESPONSE_BYTES) responseBody += chunk;
      });
      response.once('end', () => {
        signal.removeEventListener('abort', handleAbort);
        const statusCode = response.statusCode ?? 0;
        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`Google Play artifact upload failed (${statusCode}). ${responseBody.slice(0, 800)}`));
          return;
        }
        try {
          resolve(JSON.parse(responseBody));
        } catch {
          reject(new Error('Google Play returned an unreadable artifact upload response.'));
        }
      });
    });
    createReadStream(artifactPath).once('error', reject).pipe(request);
  });
};

const readRequiredString = (payload: unknown, key: string): string => {
  if (!isRecord(payload) || typeof payload[key] !== 'string') {
    throw new Error(`Google Play response did not include ${key}.`);
  }
  return payload[key];
};

export class GooglePlayIntegration {
  public async validateAccess(
    configuration: GooglePlaySetupConfiguration,
    signal: AbortSignal,
  ): Promise<void> {
    const serviceAccount = await readServiceAccount(configuration.serviceAccountPath);
    const accessToken = await createAccessToken(serviceAccount, signal);
    const baseUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(configuration.packageName)}`;
    const editPayload = await requestJson(`${baseUrl}/edits`, accessToken, signal, 'POST', {});
    const editId = readRequiredString(editPayload, 'id');
    await requestJson(`${baseUrl}/edits/${encodeURIComponent(editId)}`, accessToken, signal, 'DELETE');
  }

  public async upload(options: GooglePlayUploadOptions): Promise<void> {
    const serviceAccount = await readServiceAccount(options.configuration.serviceAccountPath);
    const accessToken = await createAccessToken(serviceAccount, options.signal);
    const baseUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(options.configuration.packageName)}`;
    const editPayload = await requestJson(`${baseUrl}/edits`, accessToken, options.signal, 'POST', {});
    const editId = readRequiredString(editPayload, 'id');
    let isCommitted = false;
    try {
      const artifactType = options.artifactPath.toLocaleLowerCase('en-US').endsWith('.aab')
        ? 'bundles'
        : 'apks';
      const uploadPayload = await uploadArtifact(
        `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${encodeURIComponent(options.configuration.packageName)}/edits/${encodeURIComponent(editId)}/${artifactType}?uploadType=media`,
        accessToken,
        options.artifactPath,
        artifactType === 'bundles' ? 'application/octet-stream' : 'application/vnd.android.package-archive',
        options.signal,
      );
      const versionCodeValue = isRecord(uploadPayload) ? uploadPayload.versionCode : undefined;
      if (typeof versionCodeValue !== 'number' && typeof versionCodeValue !== 'string') {
        throw new Error('Google Play did not return an uploaded version code.');
      }
      const versionCode = String(versionCodeValue);
      const initialRelease: PlayRelease = {
        name: options.releaseName,
        releaseNotes: [{ language: options.configuration.releaseNotesLanguage, text: options.releaseNotes }],
        status: 'completed',
        versionCodes: [versionCode],
      };
      await requestJson(
        `${baseUrl}/edits/${encodeURIComponent(editId)}/tracks/${encodeURIComponent(options.configuration.initialTrack)}`,
        accessToken,
        options.signal,
        'PUT',
        { track: options.configuration.initialTrack, releases: [initialRelease] },
      );
      await requestJson(`${baseUrl}/edits/${encodeURIComponent(editId)}:commit`, accessToken, options.signal, 'POST', {});
      isCommitted = true;

      if (options.configuration.promoteAfterUpload) {
        const promotionEdit = await requestJson(`${baseUrl}/edits`, accessToken, options.signal, 'POST', {});
        const promotionEditId = readRequiredString(promotionEdit, 'id');
        const promotedRelease: PlayRelease = {
          ...initialRelease,
          status: options.configuration.promotionStatus,
          ...(options.configuration.rolloutFraction === null
            ? {}
            : { userFraction: options.configuration.rolloutFraction }),
        };
        await requestJson(
          `${baseUrl}/edits/${encodeURIComponent(promotionEditId)}/tracks/${encodeURIComponent(options.configuration.promotionTrack)}`,
          accessToken,
          options.signal,
          'PUT',
          { track: options.configuration.promotionTrack, releases: [promotedRelease] },
        );
        await requestJson(`${baseUrl}/edits/${encodeURIComponent(promotionEditId)}:commit`, accessToken, options.signal, 'POST', {});
      }
    } finally {
      if (!isCommitted) {
        try {
          await requestJson(`${baseUrl}/edits/${encodeURIComponent(editId)}`, accessToken, new AbortController().signal, 'DELETE');
        } catch {
          // An abandoned edit expires server-side; the original failure remains authoritative.
        }
      }
    }
  }
}
