import type { ApplicationDatabase } from '@main/database';
import { isRecord } from '@main/utils/FileSystem';
import type { ReleaseMode, ReleasePlatform } from '@shared/contracts/domain';
import type {
  FastActionConfiguration,
  ReleaseResult,
  RunHistoryListRequest,
  RunHistoryPage,
  RunHistorySummary,
} from '@shared/contracts/release';
import { fastActionConfigurationSchema, releaseResultSchema } from '@shared/validation';

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

const parseResult = (serializedResult: unknown): ReleaseResult => {
  if (typeof serializedResult !== 'string') {
    throw new Error('Invalid release history result data.');
  }
  const parsedResult: unknown = JSON.parse(serializedResult);
  const result = releaseResultSchema.safeParse(parsedResult);
  if (!result.success) {
    throw new Error('Invalid release history result snapshot.');
  }
  return result.data;
};

const parseRunHistoryRow = (row: unknown): RunHistorySummary => {
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
    result: parseResult(row.result_json),
    startedAt: read('started_at'),
  };
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

  public list(request: RunHistoryListRequest): RunHistoryPage {
    const cursor = request.cursor;
    const rows: unknown[] = this.database
      .prepare(
        `SELECT id, application_id, mode, platforms_json, outcome, started_at, finished_at,
          configuration_json, result_json
         FROM release_runs
         WHERE application_id = ?
           AND (
             ? IS NULL
             OR finished_at < ?
             OR (finished_at = ? AND id < ?)
           )
         ORDER BY finished_at DESC, id DESC
         LIMIT ?`,
      )
      .all(
        request.applicationId,
        cursor?.finishedAt ?? null,
        cursor?.finishedAt ?? null,
        cursor?.finishedAt ?? null,
        cursor?.id ?? null,
        request.pageSize + 1,
      );
    const runs = rows.slice(0, request.pageSize).map(parseRunHistoryRow);
    const lastRun = runs.at(-1);
    return {
      nextCursor:
        rows.length > request.pageSize && lastRun !== undefined
          ? { finishedAt: lastRun.finishedAt, id: lastRun.id }
          : null,
      runs,
    };
  }

  public clear(applicationId: string): void {
    this.database.prepare('DELETE FROM release_runs WHERE application_id = ?').run(applicationId);
  }
}
