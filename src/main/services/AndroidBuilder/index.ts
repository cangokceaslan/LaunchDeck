import path from 'node:path';
import { lstat } from 'node:fs/promises';
import type { AndroidConfiguration } from '@shared/contracts/domain';
import type { ProcessOutput } from '@main/utils/ChildProcess/index.types';
import { resolveExecutableFile, resolveExistingFile } from '@main/utils/FileSystem';
import { runExecutable } from '@main/utils/ChildProcess';

export class AndroidBuilder {
  public async resolveGradleWrapper(configuration: AndroidConfiguration): Promise<string> {
    const wrapperName = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
    return resolveExecutableFile(path.join(configuration.projectPath, wrapperName));
  }

  public async build(
    configuration: AndroidConfiguration,
    signal: AbortSignal,
    onOutput: (output: ProcessOutput) => void,
  ): Promise<string> {
    const gradleWrapperPath = await this.resolveGradleWrapper(configuration);
    const isWindows = process.platform === 'win32';
    const hasUnsafeWindowsShellCharacter =
      /["&|<>^%!]/u.test(gradleWrapperPath) ||
      gradleWrapperPath.includes(String.fromCharCode(13)) ||
      gradleWrapperPath.includes(String.fromCharCode(10));
    if (isWindows && hasUnsafeWindowsShellCharacter) {
      throw new Error('Windows Gradle wrapper yolu güvenli olmayan karakter içeriyor.');
    }
    const executablePath = isWindows
      ? await resolveExecutableFile(path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'cmd.exe'))
      : gradleWrapperPath;
    // Windows batch wrappers require cmd.exe. Inputs are limited to a validated absolute wrapper
    // path, an allowlisted Gradle task, and fixed flags; arbitrary shell text is never accepted.
    const args = isWindows
      ? [
          '/d',
          '/s',
          '/c',
          `"${gradleWrapperPath}" ${configuration.gradleTask} --rerun-tasks --console=plain`,
        ]
      : [configuration.gradleTask, '--rerun-tasks', '--console=plain'];
    const result = await runExecutable({
      args,
      cwdPath: configuration.projectPath,
      executablePath,
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
