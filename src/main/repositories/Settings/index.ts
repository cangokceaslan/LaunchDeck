import type { ApplicationDatabase } from '@main/database';
import type { AppSettings } from '@shared/contracts/settings';
import type { ThemePreference } from '@shared/contracts/domain';

const SETTINGS_KEYS = { theme: 'launchdeck.theme' } as const;

export class SettingsRepository {
  public constructor(private readonly database: ApplicationDatabase) {}

  public get(): AppSettings {
    const row: unknown = this.database
      .prepare('SELECT value_json FROM settings WHERE key = ?')
      .get(SETTINGS_KEYS.theme);
    if (typeof row !== 'object' || row === null || !('value_json' in row)) {
      return { theme: 'system' };
    }
    const serializedTheme = row.value_json;
    if (typeof serializedTheme !== 'string') {
      return { theme: 'system' };
    }
    const parsedTheme: unknown = JSON.parse(serializedTheme);
    return parsedTheme === 'light' || parsedTheme === 'dark' || parsedTheme === 'system'
      ? { theme: parsedTheme }
      : { theme: 'system' };
  }

  public updateTheme(theme: ThemePreference): AppSettings {
    this.database
      .prepare(
        `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json,
           updated_at = excluded.updated_at`,
      )
      .run(SETTINGS_KEYS.theme, JSON.stringify(theme), new Date().toISOString());
    return { theme };
  }
}
