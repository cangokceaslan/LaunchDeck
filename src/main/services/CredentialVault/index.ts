import { safeStorage } from 'electron';

export class CredentialVault {
  private assertSecureStorage(): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        'İşletim sistemi güvenli depolaması kullanılamıyor. Service Account yolu düz metin olarak saklanmayacak.',
      );
    }
    if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
      throw new Error(
        'Linux güvenli credential deposu bulunamadı. Secret Service veya KWallet yapılandırılmadan Service Account yolu saklanamaz.',
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
