import { randomUUID } from 'node:crypto';
import type { ApplicationDatabase } from '@main/database';
import { isRecord } from '@main/utils/FileSystem';
import type {
  CreateFastActionRequest,
  DeleteFastActionRequest,
  FastAction,
  FastActionConfiguration,
  UpdateFastActionRequest,
} from '@shared/contracts/release';
import { fastActionConfigurationSchema } from '@shared/validation';

const readRequiredString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`Invalid SQLite fast action field: ${key}`);
  }
  return value;
};

const migrateLegacyVersionConfiguration = (configuration: unknown): unknown => {
  if (!isRecord(configuration) || !isRecord(configuration.version)) return configuration;
  const legacyVersion = configuration.version;
  if ('android' in legacyVersion || 'ios' in legacyVersion) return configuration;
  if (
    typeof legacyVersion.versionName !== 'string' ||
    typeof legacyVersion.incrementPatch !== 'boolean' ||
    !Array.isArray(configuration.platforms)
  ) {
    return configuration;
  }

  const migratedVersion: Record<string, unknown> = {};
  if (
    configuration.platforms.includes('android') &&
    typeof legacyVersion.androidVersionCode === 'number' &&
    typeof legacyVersion.incrementAndroidVersionCode === 'boolean'
  ) {
    migratedVersion.android = {
      incrementPatch: legacyVersion.incrementPatch,
      incrementVersionCode: legacyVersion.incrementAndroidVersionCode,
      versionCode: legacyVersion.androidVersionCode,
      versionName: legacyVersion.versionName,
    };
  }
  if (
    configuration.platforms.includes('ios') &&
    typeof legacyVersion.iosBuildNumber === 'number' &&
    typeof legacyVersion.incrementIosBuildNumber === 'boolean'
  ) {
    migratedVersion.ios = {
      buildNumber: legacyVersion.iosBuildNumber,
      incrementBuildNumber: legacyVersion.incrementIosBuildNumber,
      incrementPatch: legacyVersion.incrementPatch,
      versionName: legacyVersion.versionName,
    };
  }
  return { ...configuration, version: migratedVersion };
};

const parseFastAction = (row: unknown): FastAction => {
  if (!isRecord(row)) {
    throw new Error('Invalid SQLite fast action record.');
  }
  const serializedConfiguration = readRequiredString(row, 'configuration_json');
  const parsedConfiguration: unknown = JSON.parse(serializedConfiguration);
  const configurationWithMigratedVersion =
    migrateLegacyVersionConfiguration(parsedConfiguration);
  const configurationWithSigningSelection =
    isRecord(configurationWithMigratedVersion) &&
    !('artifactSigningPlatforms' in configurationWithMigratedVersion) &&
    configurationWithMigratedVersion.mode !== 'uploadOnly' &&
    Array.isArray(configurationWithMigratedVersion.destinations) &&
    configurationWithMigratedVersion.destinations.includes('artifact') &&
    Array.isArray(configurationWithMigratedVersion.platforms)
      ? {
          ...configurationWithMigratedVersion,
          artifactSigningPlatforms: configurationWithMigratedVersion.platforms,
        }
      : configurationWithMigratedVersion;
  return {
    applicationId: readRequiredString(row, 'application_id'),
    configuration: fastActionConfigurationSchema.parse(configurationWithSigningSelection),
    createdAt: readRequiredString(row, 'created_at'),
    id: readRequiredString(row, 'id'),
    name: readRequiredString(row, 'name'),
    updatedAt: readRequiredString(row, 'updated_at'),
  };
};

export class FastActionRepository {
  public constructor(private readonly database: ApplicationDatabase) {}

  private assertUniqueName(applicationId: string, name: string, excludedId?: string): void {
    const row: unknown = excludedId === undefined
      ? this.database
          .prepare(
            'SELECT id FROM fast_actions WHERE application_id = ? AND name = ? COLLATE NOCASE',
          )
          .get(applicationId, name)
      : this.database
          .prepare(
            `SELECT id FROM fast_actions
             WHERE application_id = ? AND name = ? COLLATE NOCASE AND id <> ?`,
          )
          .get(applicationId, name, excludedId);
    if (row !== undefined) {
      throw new Error('A fast action with this name already exists for the application.');
    }
  }

  private get(applicationId: string, id: string): FastAction | null {
    const row: unknown = this.database
      .prepare('SELECT * FROM fast_actions WHERE application_id = ? AND id = ?')
      .get(applicationId, id);
    return row === undefined ? null : parseFastAction(row);
  }

  public list(applicationId: string): FastAction[] {
    const rows: unknown[] = this.database
      .prepare(
        `SELECT * FROM fast_actions
         WHERE application_id = ? ORDER BY updated_at DESC, name COLLATE NOCASE`,
      )
      .all(applicationId);
    return rows.map(parseFastAction);
  }

  public create(
    request: Omit<CreateFastActionRequest, 'configuration'> & {
      configuration: FastActionConfiguration;
    },
  ): FastAction {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    this.assertUniqueName(request.applicationId, request.name);
    this.database
      .prepare(
        `INSERT INTO fast_actions (
          id, application_id, name, configuration_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        request.applicationId,
        request.name,
        JSON.stringify(request.configuration),
        timestamp,
        timestamp,
      );
    const createdFastAction = this.get(request.applicationId, id);
    if (createdFastAction === null) {
      throw new Error('The fast action record could not be created.');
    }
    return createdFastAction;
  }

  public update(
    request: Omit<UpdateFastActionRequest, 'configuration'> & {
      configuration: FastActionConfiguration;
    },
  ): FastAction {
    this.assertUniqueName(request.applicationId, request.name, request.id);
    const result = this.database
      .prepare(
        `UPDATE fast_actions SET name = ?, configuration_json = ?, updated_at = ?
         WHERE application_id = ? AND id = ?`,
      )
      .run(
        request.name,
        JSON.stringify(request.configuration),
        new Date().toISOString(),
        request.applicationId,
        request.id,
      );
    if (result.changes !== 1) {
      throw new Error('The fast action to update was not found.');
    }
    const updatedFastAction = this.get(request.applicationId, request.id);
    if (updatedFastAction === null) {
      throw new Error('The updated fast action could not be read.');
    }
    return updatedFastAction;
  }

  public delete(request: DeleteFastActionRequest): boolean {
    return this.database
      .prepare('DELETE FROM fast_actions WHERE application_id = ? AND id = ?')
      .run(request.applicationId, request.id).changes === 1;
  }
}
