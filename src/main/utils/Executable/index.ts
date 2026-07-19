import { access } from 'node:fs/promises';
import { homedir, userInfo } from 'node:os';
import path from 'node:path';
import { constants } from 'node:fs';
import { runExecutable } from '@main/utils/ChildProcess';

const windowsExecutableExtensions = ['.exe', '.cmd', '.bat', ''];
const terminalPathMarker = '__LAUNCHDECK_TERMINAL_PATH__';
const supportedLoginShells = new Set(['bash', 'dash', 'fish', 'ksh', 'sh', 'zsh']);

let executableSearchPathInitialization: Promise<void> | null = null;

const candidateNames = (executableName: string): string[] => {
  if (process.platform !== 'win32') {
    return [executableName];
  }
  if (path.extname(executableName) !== '') {
    return [executableName];
  }
  return windowsExecutableExtensions.map((extension) => `${executableName}${extension}`);
};

const isExecutable = async (candidatePath: string): Promise<boolean> => {
  try {
    await access(candidatePath, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const getConventionalSearchPaths = (): string[] => {
  const userHomePath = homedir();
  if (process.platform === 'win32') {
    const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
    return [
      path.join(systemRoot, 'System32'),
      systemRoot,
      path.join(systemRoot, 'System32', 'Wbem'),
      ...(process.env.APPDATA === undefined ? [] : [path.join(process.env.APPDATA, 'npm')]),
      ...(process.env.LOCALAPPDATA === undefined
        ? []
        : [
            path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps'),
            path.join(process.env.LOCALAPPDATA, 'Yarn', 'bin'),
          ]),
      path.join(userHomePath, '.volta', 'bin'),
    ];
  }

  return [
    ...(process.platform === 'darwin'
      ? ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/local/sbin']
      : [
          '/home/linuxbrew/.linuxbrew/bin',
          '/home/linuxbrew/.linuxbrew/sbin',
          '/usr/local/bin',
          '/usr/local/sbin',
        ]),
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    path.join(userHomePath, '.local', 'bin'),
    path.join(userHomePath, '.volta', 'bin'),
    path.join(userHomePath, '.asdf', 'shims'),
    path.join(userHomePath, '.local', 'share', 'mise', 'shims'),
    path.join(userHomePath, '.bun', 'bin'),
    path.join(userHomePath, '.cargo', 'bin'),
    path.join(userHomePath, 'Library', 'pnpm'),
  ];
};

const normalizeSearchPaths = (searchPaths: readonly string[]): string[] => {
  const normalizedPaths: string[] = [];
  const seenPaths = new Set<string>();
  for (const searchPath of searchPaths) {
    const normalizedPath = searchPath.trim();
    if (!path.isAbsolute(normalizedPath) || seenPaths.has(normalizedPath)) continue;
    seenPaths.add(normalizedPath);
    normalizedPaths.push(normalizedPath);
  }
  return normalizedPaths;
};

const resolveLoginShellPath = async (): Promise<string | null> => {
  if (process.platform === 'win32') return null;

  const configuredShellPath = process.env.SHELL;
  const accountShellPath = userInfo().shell;
  const shellCandidates = [configuredShellPath, accountShellPath, '/bin/zsh', '/bin/bash'].filter(
    (shellPath): shellPath is string =>
      typeof shellPath === 'string' &&
      path.isAbsolute(shellPath) &&
      supportedLoginShells.has(path.basename(shellPath)),
  );
  for (const shellPath of shellCandidates) {
    if (await isExecutable(shellPath)) return shellPath;
  }
  return null;
};

const readTerminalSearchPaths = async (): Promise<string[]> => {
  const loginShellPath = await resolveLoginShellPath();
  if (loginShellPath === null) return [];

  const outputLines: string[] = [];
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 5_000);
  const fallbackSearchPath = normalizeSearchPaths([
    ...(process.env.PATH ?? '').split(path.delimiter),
    ...getConventionalSearchPaths(),
  ]).join(path.delimiter);
  try {
    // Finder-launched apps do not inherit the login shell PATH. This fixed command
    // emits only PATH and never interpolates renderer or application input.
    await runExecutable({
      args: [
        '-ilc',
        `/usr/bin/printf '${terminalPathMarker}'; /usr/bin/printenv PATH`,
      ],
      cwdPath: homedir(),
      environment: { PATH: fallbackSearchPath, SHELL: loginShellPath },
      executablePath: loginShellPath,
      maxLineLength: 32_768,
      onOutput: ({ line }) => outputLines.push(line),
      signal: abortController.signal,
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }

  const terminalPathLine = outputLines.find((line) => line.includes(terminalPathMarker));
  if (terminalPathLine === undefined) return [];
  return terminalPathLine
    .slice(terminalPathLine.indexOf(terminalPathMarker) + terminalPathMarker.length)
    .split(path.delimiter);
};

const initializeSearchPath = async (): Promise<void> => {
  const terminalSearchPaths = await readTerminalSearchPaths();
  const inheritedSearchPaths = (process.env.PATH ?? '').split(path.delimiter);
  process.env.PATH = normalizeSearchPaths([
    ...terminalSearchPaths,
    ...inheritedSearchPaths,
    ...getConventionalSearchPaths(),
  ]).join(path.delimiter);
};

export const initializeExecutableSearchPath = async (): Promise<void> => {
  executableSearchPathInitialization ??= initializeSearchPath();
  await executableSearchPathInitialization;
};

export const findExecutable = async (executableName: string): Promise<string | null> => {
  await initializeExecutableSearchPath();
  if (path.isAbsolute(executableName)) {
    return (await isExecutable(executableName)) ? executableName : null;
  }

  const pathEntries = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  for (const pathEntry of pathEntries) {
    for (const name of candidateNames(executableName)) {
      const candidatePath = path.join(pathEntry, name);
      if (await isExecutable(candidatePath)) {
        return candidatePath;
      }
    }
  }
  return null;
};
