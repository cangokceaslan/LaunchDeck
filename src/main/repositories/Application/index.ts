import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { ApplicationDatabase } from '@main/database';
import type { CredentialVault } from '@main/services/CredentialVault';
import { isRecord } from '@main/utils/FileSystem';
import type {
  PersistApplicationInput,
  StoredApplication,
} from '@main/repositories/Application/index.types';
import type {
  AndroidConfiguration,
  AndroidSigningConfiguration,
  AppStoreConnectConfiguration,
  ApplicationDetail,
  ApplicationSummary,
  GooglePlayConfiguration,
  IosConfiguration,
  PipelineHook,
  ReleasePlatform,
} from '@shared/contracts/domain';
import {
  applicationReleaseConfigurationSchema,
  androidConfigurationSchema,
  iosConfigurationSchema,
} from '@shared/validation';

type StoredReleaseConfiguration = {
  androidSigning: AndroidSigningConfiguration | null;
  appStoreConnect: AppStoreConnectConfiguration | null;
  artifactGeneration: ApplicationDetail['artifactGeneration'];
  firebaseDistribution: ApplicationDetail['firebaseDistribution'];
  googlePlay: GooglePlayConfiguration | null;
  iosSigning: ApplicationDetail['iosSigning'];
};

const parseEncryptedJson = (
  encryptedValue: unknown,
  credentialVault: CredentialVault,
): Record<string, unknown> | null => {
  if (encryptedValue === null) return null;
  if (typeof encryptedValue !== 'string') {
    throw new Error('Invalid encrypted application credential field.');
  }
  const parsedValue: unknown = JSON.parse(credentialVault.decryptString(encryptedValue));
  if (!isRecord(parsedValue)) {
    throw new Error('Invalid encrypted application credential payload.');
  }
  return parsedValue;
};

const encryptJson = (
  value: Record<string, string> | null,
  credentialVault: CredentialVault,
): string | null => value === null ? null : credentialVault.encryptString(JSON.stringify(value));

const readRequiredString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`Invalid SQLite application field: ${key}`);
  }
  return value;
};

const parseJson = (serializedValue: string): unknown => {
  const parsedValue: unknown = JSON.parse(serializedValue);
  return parsedValue;
};

const isHookPhase = (value: string): value is PipelineHook['phase'] =>
  value === 'preBuild' || value === 'postBuild' || value === 'preUpload' || value === 'postUpload';

const isHookPlatform = (value: string): value is PipelineHook['platform'] =>
  value === 'android' || value === 'ios' || value === 'all';

const parseStringArray = (serializedValue: string): string[] => {
  const parsedValue = parseJson(serializedValue);
  if (!Array.isArray(parsedValue) || !parsedValue.every((item) => typeof item === 'string')) {
    throw new Error('Invalid SQLite string array.');
  }
  return parsedValue;
};

const parseAndroidConfiguration = (serializedValue: unknown): AndroidConfiguration | null => {
  if (serializedValue === null) {
    return null;
  }
  if (typeof serializedValue !== 'string') {
    throw new Error('Invalid SQLite platform configuration.');
  }
  const configuration = androidConfigurationSchema.parse(parseJson(serializedValue));
  return {
    ...configuration,
    aabArtifactPath: path.resolve(configuration.projectPath, configuration.aabArtifactPath),
    artifactPath: path.resolve(configuration.projectPath, configuration.artifactPath),
  };
};

const parseIosConfiguration = (serializedValue: unknown): IosConfiguration | null => {
  if (serializedValue === null) {
    return null;
  }
  if (typeof serializedValue !== 'string') {
    throw new Error('Invalid SQLite platform configuration.');
  }
  return iosConfigurationSchema.parse(parseJson(serializedValue));
};

const parseHook = (row: unknown): PipelineHook => {
  if (!isRecord(row)) {
    throw new Error('Invalid SQLite pipeline hook record.');
  }
  const phase = readRequiredString(row, 'phase');
  const platform = readRequiredString(row, 'platform');
  if (!isHookPhase(phase)) {
    throw new Error('Invalid pipeline hook phase.');
  }
  if (!isHookPlatform(platform)) {
    throw new Error('Invalid pipeline hook platform.');
  }
  const isEnabled = row.is_enabled;
  if (typeof isEnabled !== 'number') {
    throw new Error('Invalid pipeline hook state.');
  }
  return {
    command: readRequiredString(row, 'command_text'),
    cwdPath: readRequiredString(row, 'cwd_path'),
    id: readRequiredString(row, 'id'),
    isEnabled: isEnabled === 1,
    name: readRequiredString(row, 'name'),
    phase,
    platform,
  };
};

export class ApplicationRepository {
  public constructor(
    private readonly database: ApplicationDatabase,
    private readonly credentialVault: CredentialVault,
  ) {}

  private getHooks(applicationId: string): PipelineHook[] {
    const rows: unknown[] = this.database
      .prepare(
        `SELECT id, name, phase, platform, command_text, cwd_path, is_enabled
         FROM pipeline_hooks WHERE application_id = ? ORDER BY sort_order`,
      )
      .all(applicationId);
    return rows.map(parseHook);
  }

  private parseApplication(row: unknown, includeCredential: false): ApplicationDetail;
  private parseApplication(row: unknown, includeCredential: true): StoredApplication;
  private parseApplication(
    row: unknown,
    includeCredential: boolean,
  ): StoredApplication | ApplicationDetail {
    if (!isRecord(row)) {
      throw new Error('Invalid SQLite application record.');
    }
    const id = readRequiredString(row, 'id');
    const android = parseAndroidConfiguration(row.android_json);
    const ios = parseIosConfiguration(row.ios_json);
    const artifactOutputDirectoryPath = row.artifact_output_directory_path;
    if (artifactOutputDirectoryPath !== null && typeof artifactOutputDirectoryPath !== 'string') {
      throw new Error('Invalid SQLite artifact output directory.');
    }
    const platforms: ReleasePlatform[] = [];
    if (android !== null) {
      platforms.push('android');
    }
    if (ios !== null) {
      platforms.push('ios');
    }
    const releaseConfiguration = applicationReleaseConfigurationSchema.parse(
      parseJson(readRequiredString(row, 'release_configuration_json')),
    ) satisfies StoredReleaseConfiguration;
    const detail: ApplicationDetail = {
      android,
      androidSigning: releaseConfiguration.androidSigning,
      appStoreConnect: releaseConfiguration.appStoreConnect,
      artifactGeneration: releaseConfiguration.artifactGeneration,
      artifactOutputDirectoryPath,
      createdAt: readRequiredString(row, 'created_at'),
      distributionGroups: parseStringArray(readRequiredString(row, 'distribution_groups_json')),
      firebaseDistribution: releaseConfiguration.firebaseDistribution,
      firebaseProjectId: readRequiredString(row, 'firebase_project_id'),
      googlePlay: releaseConfiguration.googlePlay,
      hasServiceAccount: readRequiredString(row, 'service_account_file_name') !== '',
      hooks: this.getHooks(id),
      id,
      ios,
      iosSigning: releaseConfiguration.iosSigning,
      name: readRequiredString(row, 'name'),
      platforms,
      serviceAccountFileName: readRequiredString(row, 'service_account_file_name'),
      updatedAt: readRequiredString(row, 'updated_at'),
    };

    if (!includeCredential) {
      return detail;
    }
    const androidSigningCredentials = parseEncryptedJson(
      row.android_signing_credentials_encrypted,
      this.credentialVault,
    );
    const googlePlayCredentials = parseEncryptedJson(
      row.google_play_credentials_encrypted,
      this.credentialVault,
    );
    const appStoreConnectCredentials = parseEncryptedJson(
      row.app_store_connect_credentials_encrypted,
      this.credentialVault,
    );
    return {
      ...detail,
      androidSigning:
        detail.androidSigning === null || androidSigningCredentials === null
          ? null
          : {
              keyAlias: detail.androidSigning.keyAlias,
              keyPassword: readRequiredString(androidSigningCredentials, 'keyPassword'),
              keystorePath: readRequiredString(androidSigningCredentials, 'keystorePath'),
              storePassword: readRequiredString(androidSigningCredentials, 'storePassword'),
            },
      appStoreConnect:
        detail.appStoreConnect === null || appStoreConnectCredentials === null
          ? null
          : {
              apiKeyId: detail.appStoreConnect.apiKeyId,
              apiKeyPath: readRequiredString(appStoreConnectCredentials, 'apiKeyPath'),
              issuerId: detail.appStoreConnect.issuerId,
            },
      googlePlay:
        detail.googlePlay === null || googlePlayCredentials === null
          ? null
          : {
              ...detail.googlePlay,
              serviceAccountPath: readRequiredString(googlePlayCredentials, 'serviceAccountPath'),
            },
      serviceAccountPath:
        detail.hasServiceAccount
          ? this.credentialVault.decryptPath(readRequiredString(row, 'service_account_path_encrypted'))
          : null,
    };
  }

  public create(input: PersistApplicationInput): ApplicationDetail {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO applications (
            id, name, firebase_project_id, service_account_path_encrypted,
            service_account_file_name, distribution_groups_json, android_json,
            ios_json, artifact_output_directory_path, release_configuration_json,
            android_signing_credentials_encrypted, google_play_credentials_encrypted,
            app_store_connect_credentials_encrypted, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.name,
          input.firebaseProjectId,
          this.credentialVault.encryptPath(input.serviceAccountPath ?? ''),
          input.serviceAccountFileName,
          JSON.stringify(input.distributionGroups),
          input.android === null ? null : JSON.stringify(input.android),
          input.ios === null ? null : JSON.stringify(input.ios),
          input.artifactOutputDirectoryPath,
          JSON.stringify(this.createReleaseConfiguration(input)),
          encryptJson(
            input.androidSigning === null
              ? null
              : {
                  keyPassword: input.androidSigning.keyPassword,
                  keystorePath: input.androidSigning.keystorePath,
                  storePassword: input.androidSigning.storePassword,
                },
            this.credentialVault,
          ),
          encryptJson(
            input.googlePlay === null
              ? null
              : { serviceAccountPath: input.googlePlay.serviceAccountPath },
            this.credentialVault,
          ),
          encryptJson(
            input.appStoreConnect === null
              ? null
              : { apiKeyPath: input.appStoreConnect.apiKeyPath },
            this.credentialVault,
          ),
          timestamp,
          timestamp,
        );
      this.replaceHooks(id, input.hooks);
    })();
    const createdApplication = this.get(id);
    if (createdApplication === null) {
      throw new Error('The application record could not be created.');
    }
    return createdApplication;
  }

  public update(id: string, input: PersistApplicationInput): ApplicationDetail {
    const timestamp = new Date().toISOString();
    const encryptedPath = this.credentialVault.encryptPath(input.serviceAccountPath ?? '');
    this.database.transaction(() => {
      const result = this.database
        .prepare(
          `UPDATE applications SET name = ?, firebase_project_id = ?,
            service_account_path_encrypted = ?, service_account_file_name = ?,
            distribution_groups_json = ?, android_json = ?, ios_json = ?,
            artifact_output_directory_path = ?, release_configuration_json = ?,
            android_signing_credentials_encrypted = ?, google_play_credentials_encrypted = ?,
            app_store_connect_credentials_encrypted = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          input.name,
          input.firebaseProjectId,
          encryptedPath,
          input.serviceAccountFileName,
          JSON.stringify(input.distributionGroups),
          input.android === null ? null : JSON.stringify(input.android),
          input.ios === null ? null : JSON.stringify(input.ios),
          input.artifactOutputDirectoryPath,
          JSON.stringify(this.createReleaseConfiguration(input)),
          encryptJson(
            input.androidSigning === null
              ? null
              : {
                  keyPassword: input.androidSigning.keyPassword,
                  keystorePath: input.androidSigning.keystorePath,
                  storePassword: input.androidSigning.storePassword,
                },
            this.credentialVault,
          ),
          encryptJson(
            input.googlePlay === null
              ? null
              : { serviceAccountPath: input.googlePlay.serviceAccountPath },
            this.credentialVault,
          ),
          encryptJson(
            input.appStoreConnect === null
              ? null
              : { apiKeyPath: input.appStoreConnect.apiKeyPath },
            this.credentialVault,
          ),
          timestamp,
          id,
        );
      if (result.changes !== 1) {
        throw new Error('The application to update was not found.');
      }
      this.replaceHooks(id, input.hooks);
    })();
    const updatedApplication = this.get(id);
    if (updatedApplication === null) {
      throw new Error('The application record could not be updated.');
    }
    return updatedApplication;
  }

  private createReleaseConfiguration(input: PersistApplicationInput): StoredReleaseConfiguration {
    return {
      androidSigning:
        input.androidSigning === null
          ? null
          : {
              isConfigured: true,
              keyAlias: input.androidSigning.keyAlias,
              keystoreFileName: path.basename(input.androidSigning.keystorePath),
            },
      appStoreConnect:
        input.appStoreConnect === null
          ? null
          : {
              apiKeyFileName: path.basename(input.appStoreConnect.apiKeyPath),
              apiKeyId: input.appStoreConnect.apiKeyId,
              hasApiKey: true,
              issuerId: input.appStoreConnect.issuerId,
            },
      artifactGeneration: input.artifactGeneration,
      firebaseDistribution: input.firebaseDistribution,
      googlePlay:
        input.googlePlay === null
          ? null
          : {
              artifactType: input.googlePlay.artifactType,
              hasServiceAccount: true,
              initialTrack: input.googlePlay.initialTrack,
              packageName: input.googlePlay.packageName,
              promoteAfterUpload: input.googlePlay.promoteAfterUpload,
              promotionStatus: input.googlePlay.promotionStatus,
              promotionTrack: input.googlePlay.promotionTrack,
              releaseNotesLanguage: input.googlePlay.releaseNotesLanguage,
              rolloutFraction: input.googlePlay.rolloutFraction,
              serviceAccountFileName: path.basename(input.googlePlay.serviceAccountPath),
            },
      iosSigning: input.iosSigning,
    };
  }

  public updateArtifactOutputDirectory(
    id: string,
    artifactOutputDirectoryPath: string,
  ): ApplicationDetail {
    const result = this.database
      .prepare(
        'UPDATE applications SET artifact_output_directory_path = ?, updated_at = ? WHERE id = ?',
      )
      .run(artifactOutputDirectoryPath, new Date().toISOString(), id);
    if (result.changes !== 1) {
      throw new Error('The application to update was not found.');
    }
    const application = this.get(id);
    if (application === null) {
      throw new Error('The updated application could not be read.');
    }
    return application;
  }

  private replaceHooks(applicationId: string, hooks: PipelineHook[]): void {
    this.database.prepare('DELETE FROM pipeline_hooks WHERE application_id = ?').run(applicationId);
    const insertHook = this.database.prepare(
      `INSERT INTO pipeline_hooks (
        id, application_id, name, phase, platform, executable_path, args_json,
        cwd_path, is_enabled, sort_order, command_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    hooks.forEach((hook, index) => {
      insertHook.run(
        hook.id,
        applicationId,
        hook.name,
        hook.phase,
        hook.platform,
        '',
        '[]',
        hook.cwdPath,
        hook.isEnabled ? 1 : 0,
        index,
        hook.command,
      );
    });
  }

  public get(id: string): ApplicationDetail | null {
    const row: unknown = this.database.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    return row === undefined ? null : this.parseApplication(row, false);
  }

  public getStored(id: string): StoredApplication | null {
    const row: unknown = this.database.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    return row === undefined ? null : this.parseApplication(row, true);
  }

  public list(): ApplicationSummary[] {
    const rows: unknown[] = this.database
      .prepare('SELECT * FROM applications ORDER BY updated_at DESC, name COLLATE NOCASE')
      .all();
    return rows.map((row) => {
      const detail = this.parseApplication(row, false);
      return {
        createdAt: detail.createdAt,
        firebaseProjectId: detail.firebaseProjectId,
        id: detail.id,
        name: detail.name,
        platforms: detail.platforms,
        updatedAt: detail.updatedAt,
      };
    });
  }

  public delete(id: string): boolean {
    return this.database.prepare('DELETE FROM applications WHERE id = ?').run(id).changes === 1;
  }
}
