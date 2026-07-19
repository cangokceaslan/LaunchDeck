import type { SchemaMigration } from '@main/database/index.types';

export const fastActionsMigration: SchemaMigration = {
  name: 'application_fast_actions',
  run(database) {
    database.exec(`
      CREATE TABLE fast_actions (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        name TEXT NOT NULL,
        configuration_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX fast_actions_application_name_idx
        ON fast_actions(application_id, name COLLATE NOCASE);
    `);
  },
  version: 5,
};
