import type { SchemaMigration } from '@main/database/index.types';

const DEFAULT_RELEASE_CONFIGURATION = JSON.stringify({
  androidSigning: null,
  appStoreConnect: null,
  artifactGeneration: {
    androidArtifactTypes: ['apk', 'aab'],
    isEnabled: true,
    isIosIpaEnabled: true,
    requiresAndroidSigning: false,
    requiresIosSigning: true,
  },
  firebaseDistribution: {
    isEnabled: true,
    requiresAndroidSigning: false,
    requiresIosSigning: true,
  },
  googlePlay: null,
  iosSigning: {
    developmentTeamId: '',
    isEnabled: true,
  },
});

export const distributionAndSigningMigration: SchemaMigration = {
  name: 'distribution_and_signing_configuration',
  run(database) {
    database.exec(`
      ALTER TABLE applications
        ADD COLUMN release_configuration_json TEXT NOT NULL
        DEFAULT '${DEFAULT_RELEASE_CONFIGURATION.replaceAll("'", "''")}';
      ALTER TABLE applications ADD COLUMN android_signing_credentials_encrypted TEXT;
      ALTER TABLE applications ADD COLUMN google_play_credentials_encrypted TEXT;
      ALTER TABLE applications ADD COLUMN app_store_connect_credentials_encrypted TEXT;
    `);
  },
  version: 4,
};
