import type { ApplicationDatabase } from '@main/database';
import { isRecord } from '@main/utils/FileSystem';
import type { ReleaseMode, ReleasePlatform } from '@shared/contracts/domain';
import type { ReleaseResult, RunHistorySummary } from '@shared/contracts/release';

const parsePlatforms = (serializedPlatforms: string): ReleasePlatform[] => {
  const platforms: unknown = JSON.parse(serializedPlatforms);
  if (
    !Array.isArray(platforms) ||
    !platforms.every((platform) => platform === 'android' || platform === 'ios')
  ) {
    throw new Error('Build geçmişi platform verisi geçersiz.');
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

export class RunHistoryRepository {
  public constructor(private readonly database: ApplicationDatabase) {}

  public add(result: ReleaseResult): void {
    this.database
      .prepare(
        `INSERT INTO release_runs (
          id, application_id, mode, platforms_json, outcome,
          started_at, finished_at, result_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
      );
  }

  public list(applicationId: string): RunHistorySummary[] {
    const rows: unknown[] = this.database
      .prepare(
        `SELECT id, application_id, mode, platforms_json, outcome, started_at, finished_at
         FROM release_runs WHERE application_id = ? ORDER BY finished_at DESC LIMIT 10`,
      )
      .all(applicationId);
    return rows.map((row) => {
      if (!isRecord(row)) {
        throw new Error('Build geçmişi kaydı geçersiz.');
      }
      const read = (key: string): string => {
        const value = row[key];
        if (typeof value !== 'string') {
          throw new Error(`Build geçmişi alanı geçersiz: ${key}`);
        }
        return value;
      };
      const mode = read('mode');
      const outcome = read('outcome');
      if (!isReleaseMode(mode)) {
        throw new Error('Build geçmişi modu geçersiz.');
      }
      if (!isReleaseOutcome(outcome)) {
        throw new Error('Build geçmişi sonucu geçersiz.');
      }
      return {
        applicationId: read('application_id'),
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
