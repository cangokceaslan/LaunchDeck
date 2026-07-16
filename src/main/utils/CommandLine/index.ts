import path from 'node:path';
import { resolveExecutableFile } from '@main/utils/FileSystem';
import { findExecutable } from '@main/utils/Executable';

export type ResolvedCommandLine = {
  args: string[];
  executablePath: string;
};

const parseCommandLine = (command: string): string[] => {
  const tokens: string[] = [];
  let currentToken = '';
  let hasToken = false;
  let quote: 'single' | 'double' | null = null;
  let isEscaped = false;

  const commitToken = (): void => {
    if (!hasToken) return;
    tokens.push(currentToken);
    currentToken = '';
    hasToken = false;
  };

  const normalizedCommand = command.trim();
  for (let index = 0; index < normalizedCommand.length; index += 1) {
    const character = normalizedCommand[index];
    if (character === undefined) continue;
    if (isEscaped) {
      currentToken += character;
      hasToken = true;
      isEscaped = false;
      continue;
    }
    const nextCharacter = normalizedCommand[index + 1];
    const canEscapeNextCharacter =
      nextCharacter !== undefined &&
      (nextCharacter === '\\' || nextCharacter === '"' || nextCharacter === "'" || /\s/u.test(nextCharacter));
    if (character === '\\' && quote !== 'single' && canEscapeNextCharacter) {
      isEscaped = true;
      hasToken = true;
      continue;
    }
    if (character === "'" && quote !== 'double') {
      quote = quote === 'single' ? null : 'single';
      hasToken = true;
      continue;
    }
    if (character === '"' && quote !== 'single') {
      quote = quote === 'double' ? null : 'double';
      hasToken = true;
      continue;
    }
    if (/\s/u.test(character) && quote === null) {
      commitToken();
      continue;
    }
    currentToken += character;
    hasToken = true;
  }

  if (isEscaped) {
    throw new Error('The command cannot end with an escape character.');
  }
  if (quote !== null) {
    throw new Error('The command contains an unclosed quote.');
  }
  commitToken();
  if (tokens.length === 0 || tokens[0] === '') {
    throw new Error('Enter a command to run.');
  }
  return tokens;
};

export const resolveCommandLine = async (
  command: string,
  cwdPath: string,
): Promise<ResolvedCommandLine> => {
  const [executableName, ...args] = parseCommandLine(command);
  if (executableName === undefined) {
    throw new Error('Enter a command to run.');
  }

  const hasDirectorySeparator = executableName.includes('/') || executableName.includes('\\');
  const executablePath =
    path.isAbsolute(executableName) || hasDirectorySeparator
      ? await resolveExecutableFile(path.resolve(cwdPath, executableName))
      : await findExecutable(executableName);

  if (executablePath === null) {
    throw new Error(`Command not found: ${executableName}`);
  }
  if (
    process.platform === 'win32' &&
    (executablePath.toLowerCase().endsWith('.bat') || executablePath.toLowerCase().endsWith('.cmd'))
  ) {
    throw new Error('Custom pipeline commands on Windows must resolve to an .exe executable.');
  }

  return { args, executablePath };
};
