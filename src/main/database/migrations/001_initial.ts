import type { SchemaMigration } from '@main/database/index.types';

export const initialSchemaMigration: SchemaMigration = {
  name: 'initial_release_distribution_schema',
  run(database) {
    database.exec(`
      CREATE TABLE applications (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        firebase_project_id TEXT NOT NULL,
        service_account_path_encrypted TEXT NOT NULL,
        service_account_file_name TEXT NOT NULL,
        distribution_groups_json TEXT NOT NULL,
        android_json TEXT,
        ios_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE pipeline_hooks (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phase TEXT NOT NULL CHECK (phase IN ('preBuild', 'postBuild', 'preUpload', 'postUpload')),
        platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'all')),
        executable_path TEXT NOT NULL,
        args_json TEXT NOT NULL,
        cwd_path TEXT NOT NULL,
        is_enabled INTEGER NOT NULL CHECK (is_enabled IN (0, 1)),
        sort_order INTEGER NOT NULL,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
      );

      CREATE TABLE release_runs (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('buildOnly', 'uploadOnly', 'buildAndUpload')),
        platforms_json TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'partiallySucceeded', 'failed', 'cancelled')),
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        result_json TEXT NOT NULL,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
      );

      CREATE INDEX release_runs_application_finished_idx
        ON release_runs(application_id, finished_at DESC);

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TRIGGER release_runs_keep_latest_ten
      AFTER INSERT ON release_runs
      BEGIN
        DELETE FROM release_runs
        WHERE application_id = NEW.application_id
          AND id NOT IN (
            SELECT id
            FROM release_runs
            WHERE application_id = NEW.application_id
            ORDER BY finished_at DESC, id DESC
            LIMIT 10
          );
      END;
    `);
  },
  version: 1,
};
