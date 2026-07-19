import type { SchemaMigration } from '@main/database/index.types';
import { initialSchemaMigration } from '@main/database/migrations/001_initial';
import { pipelineHookCommandsMigration } from '@main/database/migrations/002_pipeline_hook_commands';
import { artifactOutputDirectoryMigration } from '@main/database/migrations/003_artifact_output_directory';
import { distributionAndSigningMigration } from '@main/database/migrations/004_distribution_and_signing';
import { fastActionsMigration } from '@main/database/migrations/005_fast_actions';
import { applicationIconMigration } from '@main/database/migrations/006_application_icon';
import { releaseHistoryConfigurationMigration } from '@main/database/migrations/007_release_history_configuration';
import { preserveReleaseHistoryMigration } from '@main/database/migrations/008_preserve_release_history';

export const schemaMigrations: readonly SchemaMigration[] = [
  initialSchemaMigration,
  pipelineHookCommandsMigration,
  artifactOutputDirectoryMigration,
  distributionAndSigningMigration,
  fastActionsMigration,
  applicationIconMigration,
  releaseHistoryConfigurationMigration,
  preserveReleaseHistoryMigration,
];
