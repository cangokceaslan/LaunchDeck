import type { SchemaMigration } from '@main/database/index.types';

export const artifactOutputDirectoryMigration: SchemaMigration = {
  name: 'application_artifact_output_directory',
  run(database) {
    database.exec('ALTER TABLE applications ADD COLUMN artifact_output_directory_path TEXT;');
  },
  version: 3,
};
