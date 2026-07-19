import type { ApplicationDatabase } from '@main/database';
import { isRecord } from '@main/utils/FileSystem';
import type { ReleaseMode, ReleasePlatform } from '@shared/contracts/domain';
import type {
  FastActionConfiguration,
  ReleaseResult,
  RunHistorySummary,
} from '@shared/contracts/release';
import { fastActionConfigurationSchema } from '@shared/validation';

const parsePlatforms = (serializedPlatforms: string): ReleasePlatform[] => {
  const platforms: unknown = JSON.parse(serializedPlatforms);
  if (
    !Array.isArray(platforms) ||
    !platforms.every((platform) => platform === 'android' || platform === 'ios')
  ) {
    throw new Error('Invalid build history platform data.');
  }
  return platforms;
};

const isReleaseMode = (mode: string): mode is ReleaseMode =>
  mode === 'buildOnly' || mode === 'uploadOnly' || mode === 'buildAndUpload';

const isReleaseOutcome = (outcome: string): outcome is ReleaseResult['outcome'] =>
  outcome === 'succeeded' ||
  outcome === 'partiallySucceeded' ||
  outcome === 'failed' ||
  outcome === 'cancelled';

const parseConfiguration = (serializedConfiguration: unknown): FastActionConfiguration | null => {
  if (serializedConfiguration === null) return null;
  if (typeof serializedConfiguration !== 'string') {
    throw new Error('Invalid release history configuration data.');
  }
  const parsedConfiguration: unknown = JSON.parse(serializedConfiguration);
  const result = fastActionConfigurationSchema.safeParse(parsedConfiguration);
  if (!result.success) {
    throw new Error('Invalid release history configuration snapshot.');
  }
  return result.data;
};

export class RunHistoryRepository {
  public constructor(private readonly database: ApplicationDatabase) {}

  public add(result: ReleaseResult, configuration: FastActionConfiguration): void {
    this.database
      .prepare(
        `INSERT INTO release_runs (
          id, application_id, mode, platforms_json, outcome,
          started_at, finished_at, result_json, configuration_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        result.runId,
        result.applicationId,
        result.mode,
        JSON.stringify(result.platforms.map(({ platform }) => platform)),
        result.outcome,
        result.startedAt,
        result.finishedAt,
        JSON.stringify(result),
        JSON.stringify(configuration),
      );
  }

  public list(applicationId: string): RunHistorySummary[] {
    const rows: unknown[] = this.database
      .prepare(
        `SELECT id, application_id, mode, platforms_json, outcome, started_at, finished_at,
          configuration_json
         FROM release_runs WHERE application_id = ? ORDER BY finished_at DESC LIMIT 10`,
      )
      .all(applicationId);
    return rows.map((row) => {
      if (!isRecord(row)) {
        throw new Error('Invalid build history record.');
      }
      const read = (key: string): string => {
        const value = row[key];
        if (typeof value !== 'string') {
          throw new Error(`Invalid build history field: ${key}`);
        }
        return value;
      };
      const mode = read('mode');
      const outcome = read('outcome');
      if (!isReleaseMode(mode)) {
        throw new Error('Invalid build history mode.');
      }
      if (!isReleaseOutcome(outcome)) {
        throw new Error('Invalid build history outcome.');
      }
      return {
        applicationId: read('application_id'),
        configuration: parseConfiguration(row.configuration_json),
        finishedAt: read('finished_at'),
        id: read('id'),
        mode,
        outcome,
        platforms: parsePlatforms(read('platforms_json')),
        startedAt: read('started_at'),
      };
    });
  }

  public clear(applicationId: string): void {
    this.database.prepare('DELETE FROM release_runs WHERE application_id = ?').run(applicationId);
  }
}
