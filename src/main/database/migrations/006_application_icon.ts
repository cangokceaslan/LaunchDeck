import type { SchemaMigration } from '@main/database/index.types';

export const applicationIconMigration: SchemaMigration = {
  name: 'application_icon',
  run(database) {
    database.exec('ALTER TABLE applications ADD COLUMN icon_data_url TEXT;');
  },
  version: 6,
};
