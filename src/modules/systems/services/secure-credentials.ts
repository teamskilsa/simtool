// modules/systems/services/secure-credentials.ts
import { AES, enc } from 'crypto-js';

// Secret key for local encryption - in production, this should be environment-specific
const ENCRYPTION_KEY = 'your-secure-key-here';

export class SecureCredentialsManager {
  private static encryptData(data: string): string {
    return AES.encrypt(data, ENCRYPTION_KEY).toString();
  }

  private static decryptData(encryptedData: string): string {
    const bytes = AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(enc.Utf8);
  }

  static storeCredentials(systemId: number, credentials: { username: string; password: string }) {
    const encryptedData = this.encryptData(JSON.stringify({
      username: credentials.username,
      password: credentials.password,
      timestamp: Date.now()
    }));

    localStorage.setItem(`system_creds_${systemId}`, encryptedData);
  }

  static getCredentials(systemId: number): { username: string; password: string } | null {
    const encryptedData = localStorage.getItem(`system_creds_${systemId}`);
    if (!encryptedData) return null;

    try {
      const decryptedData = JSON.parse(this.decryptData(encryptedData));
      return {
        username: decryptedData.username,
        password: decryptedData.password
      };
    } catch (error) {
      console.error('Failed to decrypt credentials:', error);
      return null;
    }
  }

  static removeCredentials(systemId: number) {
    localStorage.removeItem(`system_creds_${systemId}`);
  }
}
