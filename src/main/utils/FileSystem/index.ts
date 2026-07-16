import { access, lstat, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';

const MAX_CONFIGURATION_BYTES = 2 * 1024 * 1024;

export const resolveExistingFile = async (
  selectedPath: string,
  expectedExtensions: readonly string[] = [],
): Promise<string> => {
  const normalizedPath = path.resolve(selectedPath.trim());
  const fileStats = await lstat(normalizedPath);
  if (!fileStats.isFile()) {
    throw new Error(`Expected a file: ${normalizedPath}`);
  }

  const resolvedPath = await realpath(normalizedPath);
  if (
    expectedExtensions.length > 0 &&
    !expectedExtensions.some((extension) => resolvedPath.toLowerCase().endsWith(extension))
  ) {
    throw new Error(`Expected file extension: ${expectedExtensions.join(', ')}`);
  }

  await access(resolvedPath, constants.R_OK);
  return resolvedPath;
};

export const resolveExecutableFile = async (selectedPath: string): Promise<string> => {
  const normalizedPath = path.resolve(selectedPath.trim());
  const resolvedPath = await realpath(normalizedPath);
  const fileStats = await stat(resolvedPath);
  if (!fileStats.isFile()) {
    throw new Error(`Expected an executable file: ${normalizedPath}`);
  }
  await access(resolvedPath, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
  return resolvedPath;
};

export const resolveExistingDirectory = async (selectedPath: string): Promise<string> => {
  const normalizedPath = path.resolve(selectedPath.trim());
  const directoryStats = await lstat(normalizedPath);
  if (!directoryStats.isDirectory()) {
    throw new Error(`Expected a directory: ${normalizedPath}`);
  }

  const resolvedPath = await realpath(normalizedPath);
  await access(resolvedPath, constants.R_OK);
  return resolvedPath;
};

export const resolveWritableDirectory = async (selectedPath: string): Promise<string> => {
  const resolvedPath = await resolveExistingDirectory(selectedPath);
  await access(resolvedPath, constants.W_OK | constants.X_OK);
  return resolvedPath;
};

export const resolveExistingBundlePath = async (
  selectedPath: string,
  expectedExtensions: readonly string[],
): Promise<string> => {
  const normalizedPath = path.resolve(selectedPath.trim());
  const pathStats = await lstat(normalizedPath);
  if (!pathStats.isDirectory() && !pathStats.isFile()) {
    throw new Error(`Expected a file or package directory: ${normalizedPath}`);
  }
  const resolvedPath = await realpath(normalizedPath);
  if (!expectedExtensions.some((extension) => resolvedPath.toLowerCase().endsWith(extension))) {
    throw new Error(`Expected package extension: ${expectedExtensions.join(', ')}`);
  }
  await access(resolvedPath, constants.R_OK);
  return resolvedPath;
};

export const readJsonConfiguration = async (filePath: string): Promise<unknown> => {
  const fileStats = await lstat(filePath);
  if (fileStats.size > MAX_CONFIGURATION_BYTES) {
    throw new Error('The configuration file exceeds the allowed size.');
  }

  const contents = await readFile(filePath, 'utf8');
  const parsedValue: unknown = JSON.parse(contents);
  return parsedValue;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const readStringProperty = (
  record: Record<string, unknown>,
  propertyName: string,
): string | null => {
  const property = record[propertyName];
  return typeof property === 'string' && property.trim() !== '' ? property.trim() : null;
};
