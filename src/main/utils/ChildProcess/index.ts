import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import type {
  ProcessExecutionResult,
  ProcessOutput,
  RunExecutableOptions,
} from '@main/utils/ChildProcess/index.types';

const APPROVED_ENVIRONMENT_KEYS = [
  'HOME',
  'LANG',
  'LC_ALL',
  'LOCALAPPDATA',
  'PATH',
  'SystemRoot',
  'TEMP',
  'TMP',
  'TMPDIR',
  'USERPROFILE',
] as const;

const createControlledEnvironment = (
  overrides: Readonly<Record<string, string>> = {},
): NodeJS.ProcessEnv => {
  const environment: NodeJS.ProcessEnv = {};
  for (const environmentKey of APPROVED_ENVIRONMENT_KEYS) {
    const environmentValue = process.env[environmentKey];
    if (environmentValue !== undefined) {
      environment[environmentKey] = environmentValue;
    }
  }
  return { ...environment, ...overrides };
};

const emitLines = (
  chunk: Buffer,
  level: ProcessOutput['level'],
  onOutput: RunExecutableOptions['onOutput'],
): void => {
  for (const line of chunk.toString('utf8').split(/\r?\n/u)) {
    const trimmedLine = line.trimEnd();
    if (trimmedLine !== '') {
      onOutput({ level, line: trimmedLine.slice(0, 8_000) });
    }
  }
};

const terminateProcessTree = (childProcess: ChildProcessWithoutNullStreams): void => {
  const childPid = childProcess.pid;
  if (childPid === undefined || childProcess.killed) {
    return;
  }

  if (process.platform === 'win32') {
    const taskkillPath = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe');
    spawn(taskkillPath, ['/pid', String(childPid), '/t', '/f'], {
      shell: false,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
    return;
  }

  try {
    process.kill(-childPid, 'SIGTERM');
  } catch {
    childProcess.kill('SIGTERM');
  }
};

export const runExecutable = (options: RunExecutableOptions): Promise<ProcessExecutionResult> =>
  new Promise((resolve, reject) => {
    if (options.signal.aborted) {
      reject(new Error('İşlem iptal edildi.'));
      return;
    }

    const childProcess = spawn(options.executablePath, [...options.args], {
      cwd: options.cwdPath,
      detached: process.platform !== 'win32',
      env: createControlledEnvironment(options.environment),
      shell: false,
      windowsHide: true,
    });

    const handleAbort = (): void => terminateProcessTree(childProcess);
    options.signal.addEventListener('abort', handleAbort, { once: true });

    childProcess.stdout.on('data', (chunk: Buffer) => emitLines(chunk, 'info', options.onOutput));
    childProcess.stderr.on('data', (chunk: Buffer) => emitLines(chunk, 'error', options.onOutput));
    childProcess.once('error', (error) => {
      options.signal.removeEventListener('abort', handleAbort);
      reject(error);
    });
    childProcess.once('close', (exitCode, signal) => {
      options.signal.removeEventListener('abort', handleAbort);
      if (options.signal.aborted) {
        reject(new Error('İşlem iptal edildi.'));
        return;
      }
      resolve({ exitCode: exitCode ?? -1, signal });
    });
  });
