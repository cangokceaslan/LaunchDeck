import path from 'node:path';
import { lstat } from 'node:fs/promises';
import type {
  AndroidArtifactType,
  AndroidConfiguration,
} from '@shared/contracts/domain';
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
    artifactType: AndroidArtifactType,
    signal: AbortSignal,
    onOutput: (output: ProcessOutput) => void,
  ): Promise<string> {
    const gradleWrapperPath = await this.resolveGradleWrapper(configuration);
    const buildTarget =
      artifactType === 'aab'
        ? { artifactPath: configuration.aabArtifactPath, gradleTask: configuration.aabGradleTask }
        : { artifactPath: configuration.artifactPath, gradleTask: configuration.gradleTask };
    let previousArtifact: { mtimeMs: number; size: number } | null = null;
    try {
      const previousStats = await lstat(buildTarget.artifactPath);
      previousArtifact = { mtimeMs: previousStats.mtimeMs, size: previousStats.size };
    } catch {
      previousArtifact = null;
    }
    const isWindows = process.platform === 'win32';
    const hasUnsafeWindowsShellCharacter =
      /["&|<>^%!]/u.test(gradleWrapperPath) ||
      gradleWrapperPath.includes(String.fromCharCode(13)) ||
      gradleWrapperPath.includes(String.fromCharCode(10));
    if (isWindows && hasUnsafeWindowsShellCharacter) {
      throw new Error('The Windows Gradle wrapper path contains unsafe characters.');
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
          `"${gradleWrapperPath}" ${buildTarget.gradleTask} --rerun-tasks --console=plain`,
        ]
      : [buildTarget.gradleTask, '--rerun-tasks', '--console=plain'];
    const result = await runExecutable({
      args,
      cwdPath: configuration.projectPath,
      executablePath,
      onOutput,
      signal,
    });
    if (result.exitCode !== 0) {
      throw new Error(`Android build failed with exit code ${result.exitCode}.`);
    }
    const artifactPath = await resolveExistingFile(buildTarget.artifactPath, [`.${artifactType}`]);
    const artifactStats = await lstat(artifactPath);
    if (artifactStats.size === 0) {
      throw new Error(`The generated ${artifactType.toUpperCase()} file is empty.`);
    }
    if (
      previousArtifact !== null &&
      previousArtifact.mtimeMs === artifactStats.mtimeMs &&
      previousArtifact.size === artifactStats.size
    ) {
      throw new Error(`The ${artifactType.toUpperCase()} artifact was not updated by this build.`);
    }
    return artifactPath;
  }
}
