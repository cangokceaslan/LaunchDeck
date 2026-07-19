import type { ApplicationDatabase } from '@main/database';
import type { AppSettings } from '@shared/contracts/settings';
import type { ThemePreference } from '@shared/contracts/domain';

const SETTINGS_KEYS = {
  fileSystemPermissionsReviewed: 'launchdeck.fileSystemPermissionsReviewed',
  pickerDirectory: 'launchdeck.pickerDirectory',
  theme: 'launchdeck.theme',
} as const;

export class SettingsRepository {
  public constructor(private readonly database: ApplicationDatabase) {}

  private readValue(key: string): unknown {
    const row: unknown = this.database
      .prepare('SELECT value_json FROM settings WHERE key = ?')
      .get(key);
    if (typeof row !== 'object' || row === null || !('value_json' in row)) {
      return null;
    }
    const serializedValue = row.value_json;
    if (typeof serializedValue !== 'string') {
      return null;
    }
    try {
      const parsedValue: unknown = JSON.parse(serializedValue);
      return parsedValue;
    } catch {
      return null;
    }
  }

  private writeValue(key: string, value: unknown): void {
    this.database
      .prepare(
        `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json,
           updated_at = excluded.updated_at`,
      )
      .run(key, JSON.stringify(value), new Date().toISOString());
  }

  public get(): AppSettings {
    const parsedTheme = this.readValue(SETTINGS_KEYS.theme);
    return parsedTheme === 'light' || parsedTheme === 'dark' || parsedTheme === 'system'
      ? { theme: parsedTheme }
      : { theme: 'system' };
  }

  public getLastPickerDirectory(pickerId: string): string | null {
    const directory = this.readValue(`${SETTINGS_KEYS.pickerDirectory}.${pickerId}`);
    return typeof directory === 'string' && directory.trim() !== '' ? directory : null;
  }

  public hasReviewedFileSystemPermissions(): boolean {
    return this.readValue(SETTINGS_KEYS.fileSystemPermissionsReviewed) === true;
  }

  public markFileSystemPermissionsReviewed(): void {
    this.writeValue(SETTINGS_KEYS.fileSystemPermissionsReviewed, true);
  }

  public updateLastPickerDirectory(pickerId: string, directory: string): void {
    this.writeValue(`${SETTINGS_KEYS.pickerDirectory}.${pickerId}`, directory);
  }

  public updateTheme(theme: ThemePreference): AppSettings {
    this.writeValue(SETTINGS_KEYS.theme, theme);
    return { theme };
  }
}
