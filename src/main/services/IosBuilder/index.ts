import { chmod, copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { IosConfiguration } from '@shared/contracts/domain';
import type { ProcessOutput } from '@main/utils/ChildProcess/index.types';
import { findExecutable } from '@main/utils/Executable';
import { resolveExistingFile } from '@main/utils/FileSystem';
import { runExecutable } from '@main/utils/ChildProcess';

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
      throw new Error('xcodebuild bulunamadı.');
    }
    return executablePath;
  }

  public async build(
    configuration: IosConfiguration,
    runWorkspacePath: string,
    signal: AbortSignal,
    onOutput: (output: ProcessOutput) => void,
  ): Promise<string> {
    if (process.platform !== 'darwin') {
      throw new Error('iOS build yalnız macOS üzerinde çalıştırılabilir.');
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
        throw new Error(`iOS archive ${archiveResult.exitCode} çıkış koduyla başarısız oldu.`);
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
        throw new Error(`iOS export ${exportResult.exitCode} çıkış koduyla başarısız oldu.`);
      }
      const exportedFiles = await readdir(exportPath);
      const ipaFiles = exportedFiles.filter((fileName) => fileName.toLowerCase().endsWith('.ipa'));
      if (ipaFiles.length !== 1) {
        throw new Error('iOS export klasöründe tek bir IPA bulunamadı.');
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
