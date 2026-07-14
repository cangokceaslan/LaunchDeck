import { chmod, mkdir } from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { schemaMigrations } from '@main/database/migrations';

export type ApplicationDatabase = Database.Database;

const readAppliedVersions = (database: ApplicationDatabase): Set<number> => {
  const rows: unknown[] = database
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all();

  return new Set(
    rows.map((row) => {
      if (typeof row !== 'object' || row === null || !('version' in row)) {
        throw new Error('SQLite schema migration kaydı okunamadı.');
      }

      const version = row.version;
      if (typeof version !== 'number') {
        throw new Error('SQLite schema migration sürümü geçersiz.');
      }

      return version;
    }),
  );
};

const applySchemaMigrations = (database: ApplicationDatabase): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedVersions = readAppliedVersions(database);

  for (const migration of schemaMigrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    database.transaction(() => {
      migration.run(database);
      database
        .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(migration.version, migration.name, new Date().toISOString());
    })();
  }
};

export const openApplicationDatabase = async (userDataPath: string): Promise<ApplicationDatabase> => {
  const databaseDirectory = path.join(userDataPath, 'database');
  const databasePath = path.join(databaseDirectory, 'launchdeck.db');
  await mkdir(databaseDirectory, { mode: 0o700, recursive: true });

  const database = new Database(databasePath);
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 5000');
  applySchemaMigrations(database);
  await chmod(databasePath, 0o600);

  return database;
};
