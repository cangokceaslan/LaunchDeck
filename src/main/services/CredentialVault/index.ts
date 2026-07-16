import { safeStorage } from 'electron';

export class CredentialVault {
  private assertSecureStorage(): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        'Secure operating system storage is unavailable. The service account path will not be stored as plain text.',
      );
    }
    if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
      throw new Error(
        'No secure credential store was found on Linux. The service account path cannot be stored until Secret Service or KWallet is configured.',
      );
    }
  }

  public encryptPath(credentialPath: string): string {
    this.assertSecureStorage();
    return safeStorage.encryptString(credentialPath).toString('base64');
  }

  public decryptPath(encryptedCredentialPath: string): string {
    this.assertSecureStorage();
    return safeStorage.decryptString(Buffer.from(encryptedCredentialPath, 'base64'));
  }
}
