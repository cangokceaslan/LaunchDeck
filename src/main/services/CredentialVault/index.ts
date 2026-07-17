import { safeStorage } from 'electron';

export class CredentialVault {
  private assertSecureStorage(): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        'Secure operating system storage is unavailable. Release credentials will not be stored as plain text.',
      );
    }
    if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
      throw new Error(
        'No secure credential store was found on Linux. Release credentials cannot be stored until Secret Service or KWallet is configured.',
      );
    }
  }

  public encryptString(plainText: string): string {
    this.assertSecureStorage();
    return safeStorage.encryptString(plainText).toString('base64');
  }

  public decryptString(encryptedText: string): string {
    this.assertSecureStorage();
    return safeStorage.decryptString(Buffer.from(encryptedText, 'base64'));
  }

  public encryptPath(credentialPath: string): string {
    return this.encryptString(credentialPath);
  }

  public decryptPath(encryptedCredentialPath: string): string {
    return this.decryptString(encryptedCredentialPath);
  }
}
