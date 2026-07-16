import { chmod, copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { IosConfiguration, IosSchemeListResult } from '@shared/contracts/domain';
import type { ProcessOutput } from '@main/utils/ChildProcess/index.types';
import { findExecutable } from '@main/utils/Executable';
import {
  isRecord,
  resolveExistingBundlePath,
  resolveExistingFile,
} from '@main/utils/FileSystem';
import { runExecutable } from '@main/utils/ChildProcess';

const MAX_SCHEME_OUTPUT_LENGTH = 1024 * 1024;

const readSchemes = (output: string): string[] => {
  const jsonStart = output.indexOf('{');
  const jsonEnd = output.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd < jsonStart) {
    throw new Error('The Xcode scheme list did not return readable JSON.');
  }
  const parsedOutput: unknown = JSON.parse(output.slice(jsonStart, jsonEnd + 1));
  if (!isRecord(parsedOutput)) {
    throw new Error('The Xcode scheme list is invalid.');
  }
  const container = isRecord(parsedOutput.workspace)
    ? parsedOutput.workspace
    : isRecord(parsedOutput.project)
      ? parsedOutput.project
      : null;
  if (container === null || !Array.isArray(container.schemes)) {
    throw new Error('No scheme list was found in the selected Xcode project.');
  }
  const schemes = container.schemes.filter(
    (scheme): scheme is string => typeof scheme === 'string' && scheme.trim() !== '',
  );
  return [...new Set(schemes.map((scheme) => scheme.trim()))].sort((left, right) =>
    left.localeCompare(right, 'en-US'),
  );
};

const createExportOptions = (configuration: IosConfiguration): string => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>${configuration.exportMethod}</string>
<key>signingStyle</key><string>automatic</string>
<key>destination</key><string>export</string>
<key>stripSwiftSymbols</key><true/>
</dict></plist>`;

export class IosBuilder {
  public async resolveXcodeBuild(): Promise<string> {
    const executablePath = await findExecutable('xcodebuild');
    if (executablePath === null) {
      throw new Error('xcodebuild was not found.');
    }
    return executablePath;
  }

  public async listSchemes(workspaceOrProjectPath: string): Promise<IosSchemeListResult> {
    if (process.platform !== 'darwin') {
      throw new Error('Xcode schemes can be read only on macOS.');
    }
    const resolvedBundlePath = await resolveExistingBundlePath(workspaceOrProjectPath, [
      '.xcworkspace',
      '.xcodeproj',
    ]);
    const xcodeBuildPath = await this.resolveXcodeBuild();
    const projectFlag = resolvedBundlePath.endsWith('.xcworkspace') ? '-workspace' : '-project';
    const outputLines: string[] = [];
    let outputLength = 0;
    const result = await runExecutable({
      args: ['-list', '-json', projectFlag, resolvedBundlePath],
      cwdPath: path.dirname(resolvedBundlePath),
      executablePath: xcodeBuildPath,
      onOutput: ({ level, line }) => {
        if (level === 'info' && outputLength < MAX_SCHEME_OUTPUT_LENGTH) {
          outputLines.push(line);
          outputLength += line.length + 1;
        }
      },
      signal: new AbortController().signal,
    });
    if (result.exitCode !== 0) {
      throw new Error(`The Xcode scheme list could not be read. Exit code: ${result.exitCode}.`);
    }
    const schemes = readSchemes(outputLines.join('\n'));
    if (schemes.length === 0) {
      throw new Error('No available schemes were found in the selected Xcode project.');
    }
    return { schemes };
  }

  public async build(
    configuration: IosConfiguration,
    runWorkspacePath: string,
    signal: AbortSignal,
    onOutput: (output: ProcessOutput) => void,
  ): Promise<string> {
    if (process.platform !== 'darwin') {
      throw new Error('iOS builds can run only on macOS.');
    }
    const xcodeBuildPath = await this.resolveXcodeBuild();
    const archivePath = path.join(runWorkspacePath, 'application.xcarchive');
    const exportPath = path.join(runWorkspacePath, 'export');
    const exportOptionsPath = path.join(runWorkspacePath, 'ExportOptions.plist');
    await mkdir(runWorkspacePath, { mode: 0o700, recursive: true });
    await writeFile(exportOptionsPath, createExportOptions(configuration), { mode: 0o600 });
    const projectFlag = configuration.workspaceOrProjectPath.endsWith('.xcworkspace')
      ? '-workspace'
      : '-project';

    try {
      const archiveResult = await runExecutable({
        args: [
          projectFlag,
          configuration.workspaceOrProjectPath,
          '-scheme',
          configuration.scheme,
          '-configuration',
          configuration.configuration,
          '-destination',
          'generic/platform=iOS',
          '-archivePath',
          archivePath,
          'clean',
          'archive',
        ],
        cwdPath: configuration.projectPath,
        executablePath: xcodeBuildPath,
        onOutput,
        signal,
      });
      if (archiveResult.exitCode !== 0) {
        throw new Error(`iOS archive failed with exit code ${archiveResult.exitCode}.`);
      }
      const exportResult = await runExecutable({
        args: [
          '-exportArchive',
          '-archivePath',
          archivePath,
          '-exportPath',
          exportPath,
          '-exportOptionsPlist',
          exportOptionsPath,
        ],
        cwdPath: configuration.projectPath,
        executablePath: xcodeBuildPath,
        onOutput,
        signal,
      });
      if (exportResult.exitCode !== 0) {
        throw new Error(`iOS export failed with exit code ${exportResult.exitCode}.`);
      }
      const exportedFiles = await readdir(exportPath);
      const ipaFiles = exportedFiles.filter((fileName) => fileName.toLowerCase().endsWith('.ipa'));
      if (ipaFiles.length !== 1) {
        throw new Error('Exactly one IPA file was not found in the iOS export directory.');
      }
      await mkdir(path.dirname(configuration.artifactPath), { mode: 0o700, recursive: true });
      await copyFile(path.join(exportPath, ipaFiles[0]), configuration.artifactPath);
      await chmod(configuration.artifactPath, 0o600);
      return await resolveExistingFile(configuration.artifactPath, ['.ipa']);
    } finally {
      await rm(exportOptionsPath, { force: true });
    }
  }
}
