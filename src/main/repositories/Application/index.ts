import { randomUUID } from 'node:crypto';
import type { ApplicationDatabase } from '@main/database';
import type { CredentialVault } from '@main/services/CredentialVault';
import { isRecord } from '@main/utils/FileSystem';
import type {
  PersistApplicationInput,
  StoredApplication,
} from '@main/repositories/Application/index.types';
import type {
  AndroidConfiguration,
  ApplicationDetail,
  ApplicationSummary,
  IosConfiguration,
  PipelineHook,
  ReleasePlatform,
} from '@shared/contracts/domain';
import {
  androidConfigurationSchema,
  iosConfigurationSchema,
} from '@shared/validation';

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
  return androidConfigurationSchema.parse(parseJson(serializedValue));
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
    const platforms: ReleasePlatform[] = [];
    if (android !== null) {
      platforms.push('android');
    }
    if (ios !== null) {
      platforms.push('ios');
    }
    const detail: ApplicationDetail = {
      android,
      createdAt: readRequiredString(row, 'created_at'),
      distributionGroups: parseStringArray(readRequiredString(row, 'distribution_groups_json')),
      firebaseProjectId: readRequiredString(row, 'firebase_project_id'),
      hasServiceAccount: true,
      hooks: this.getHooks(id),
      id,
      ios,
      name: readRequiredString(row, 'name'),
      platforms,
      serviceAccountFileName: readRequiredString(row, 'service_account_file_name'),
      updatedAt: readRequiredString(row, 'updated_at'),
    };

    if (!includeCredential) {
      return detail;
    }
    return {
      ...detail,
      serviceAccountPath: this.credentialVault.decryptPath(
        readRequiredString(row, 'service_account_path_encrypted'),
      ),
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
            ios_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.name,
          input.firebaseProjectId,
          this.credentialVault.encryptPath(input.serviceAccountPath),
          input.serviceAccountFileName,
          JSON.stringify(input.distributionGroups),
          input.android === null ? null : JSON.stringify(input.android),
          input.ios === null ? null : JSON.stringify(input.ios),
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
    const encryptedPath = this.credentialVault.encryptPath(input.serviceAccountPath);
    this.database.transaction(() => {
      const result = this.database
        .prepare(
          `UPDATE applications SET name = ?, firebase_project_id = ?,
            service_account_path_encrypted = ?, service_account_file_name = ?,
            distribution_groups_json = ?, android_json = ?, ios_json = ?, updated_at = ?
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
