import { access } from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';

const windowsExecutableExtensions = ['.exe', '.cmd', '.bat', ''];

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

export const findExecutable = async (executableName: string): Promise<string | null> => {
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
