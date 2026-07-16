import type { SchemaMigration } from '@main/database/index.types';

const quoteToken = (token: string): string => JSON.stringify(token);

const readLegacyHookRow = (
  row: unknown,
): { argsJson: string; executablePath: string; id: string } => {
  if (typeof row !== 'object' || row === null) {
    throw new Error('A legacy pipeline command could not be read.');
  }
  if (
    !('args_json' in row) ||
    typeof row.args_json !== 'string' ||
    !('executable_path' in row) ||
    typeof row.executable_path !== 'string' ||
    !('id' in row) ||
    typeof row.id !== 'string'
  ) {
    throw new Error('A legacy pipeline command contains invalid fields.');
  }
  return { argsJson: row.args_json, executablePath: row.executable_path, id: row.id };
};

export const pipelineHookCommandsMigration: SchemaMigration = {
  name: 'pipeline_hook_command_lines',
  run(database) {
    database.exec('ALTER TABLE pipeline_hooks ADD COLUMN command_text TEXT NOT NULL DEFAULT \'\';');
    const rows: unknown[] = database
      .prepare('SELECT id, executable_path, args_json FROM pipeline_hooks')
      .all();
    const updateCommand = database.prepare(
      'UPDATE pipeline_hooks SET command_text = ? WHERE id = ?',
    );

    for (const rawRow of rows) {
      const row = readLegacyHookRow(rawRow);
      const parsedArgs: unknown = JSON.parse(row.argsJson);
      if (!Array.isArray(parsedArgs) || !parsedArgs.every((argument) => typeof argument === 'string')) {
        throw new Error('A legacy pipeline command contains invalid arguments.');
      }
      updateCommand.run(
        [row.executablePath, ...parsedArgs].map(quoteToken).join(' '),
        row.id,
      );
    }
  },
  version: 2,
};
