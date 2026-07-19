import type { SchemaMigration } from '@main/database/index.types';

export const preserveReleaseHistoryMigration: SchemaMigration = {
  name: 'preserve_complete_release_history',
  run(database) {
    database.exec('DROP TRIGGER IF EXISTS release_runs_keep_latest_ten;');
  },
  version: 8,
};
