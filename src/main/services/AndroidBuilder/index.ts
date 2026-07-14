import path from 'node:path';
import { lstat } from 'node:fs/promises';
import type { AndroidConfiguration } from '@shared/contracts/domain';
import type { ProcessOutput } from '@main/utils/ChildProcess/index.types';
import { resolveExistingFile } from '@main/utils/FileSystem';
import { runExecutable } from '@main/utils/ChildProcess';

export class AndroidBuilder {
  public async resolveGradleWrapper(configuration: AndroidConfiguration): Promise<string> {
    const wrapperName = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
    return resolveExistingFile(path.join(configuration.projectPath, wrapperName));
  }

  public async build(
    configuration: AndroidConfiguration,
    signal: AbortSignal,
    onOutput: (output: ProcessOutput) => void,
  ): Promise<string> {
    const gradleWrapperPath = await this.resolveGradleWrapper(configuration);
    const result = await runExecutable({
      args: [configuration.gradleTask, '--rerun-tasks', '--console=plain'],
      cwdPath: configuration.projectPath,
      executablePath: gradleWrapperPath,
      onOutput,
      signal,
    });
    if (result.exitCode !== 0) {
      throw new Error(`Android build ${result.exitCode} çıkış koduyla başarısız oldu.`);
    }
    const artifactPath = await resolveExistingFile(configuration.artifactPath, ['.apk']);
    const artifactStats = await lstat(artifactPath);
    if (artifactStats.size === 0) {
      throw new Error('Üretilen APK dosyası boş.');
    }
    return artifactPath;
  }
}
