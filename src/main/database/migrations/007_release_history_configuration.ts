import type { SchemaMigration } from '@main/database/index.types';

export const releaseHistoryConfigurationMigration: SchemaMigration = {
  name: 'release_history_configuration_snapshot',
  run(database) {
    database.exec('ALTER TABLE release_runs ADD COLUMN configuration_json TEXT;');
  },
  version: 7,
};
