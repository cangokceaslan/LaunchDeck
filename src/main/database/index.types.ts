import type Database from 'better-sqlite3';

export type SchemaMigration = {
  name: string;
  run: (database: Database.Database) => void;
  version: number;
};
