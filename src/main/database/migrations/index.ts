import type { SchemaMigration } from '@main/database/index.types';
import { initialSchemaMigration } from '@main/database/migrations/001_initial';
import { pipelineHookCommandsMigration } from '@main/database/migrations/002_pipeline_hook_commands';
import { artifactOutputDirectoryMigration } from '@main/database/migrations/003_artifact_output_directory';

export const schemaMigrations: readonly SchemaMigration[] = [
  initialSchemaMigration,
  pipelineHookCommandsMigration,
  artifactOutputDirectoryMigration,
];
