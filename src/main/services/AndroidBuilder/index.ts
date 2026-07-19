import path from 'node:path';
import { access, lstat, readFile, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import type {
  AndroidArtifactType,
  AndroidConfiguration,
  AndroidSigningSetupConfiguration,
} from '@shared/contracts/domain';
import type { ProcessOutput } from '@main/utils/ChildProcess/index.types';
import {
  replaceTextFileAtomically,
  resolveExecutableFile,
  resolveExistingFile,
} from '@main/utils/FileSystem';
import { runExecutable } from '@main/utils/ChildProcess';
import { findExecutable } from '@main/utils/Executable';
import type { ResolvedAndroidReleaseVersion } from '@shared/contracts/release';

const MAX_VERSION_FILE_BYTES = 2 * 1024 * 1024;
const VERSION_CODE_PATTERN = /^([ \t]*versionCode[ \t]*(?:=[ \t]*)?)(\d+)([ \t]*(?:\/\/[^\r\n]*)?\r?)$/gmu;
const VERSION_NAME_PATTERN = /^([ \t]*versionName[ \t]*(?:=[ \t]*)?)(["'])([^"'\r\n]+)\2([ \t]*(?:\/\/[^\r\n]*)?\r?)$/gmu;
const STORE_PASSWORD_ENV = 'LAUNCHDECK_ANDROID_STORE_PASSWORD';
const GRADLE_SIGNING_STORE_FILE_ENV =
  'ORG_GRADLE_PROJECT_android.injected.signing.store.file';
const GRADLE_SIGNING_STORE_PASSWORD_ENV =
  'ORG_GRADLE_PROJECT_android.injected.signing.store.password';
const GRADLE_SIGNING_KEY_ALIAS_ENV =
  'ORG_GRADLE_PROJECT_android.injected.signing.key.alias';
const GRADLE_SIGNING_KEY_PASSWORD_ENV =
  'ORG_GRADLE_PROJECT_android.injected.signing.key.password';
const MAX_AAB_VERIFICATION_OUTPUT_LINES = 100;
const JAR_SIGNER_ENGLISH_LOCALE_ARGS = [
  '-J-Duser.language=en',
  '-J-Duser.country=US',
] as const;

type AndroidVersionFile = {
  contents: string;
  path: string;
};

type AabVerificationDiagnostics = {
  hasCertificateTrustWarning: boolean;
  hasRejectedCertificateWarning: boolean;
  isOutputComplete: boolean;
  output: ProcessOutput[];
};

const inspectAabVerificationOutput = (
  diagnostics: AabVerificationDiagnostics,
  output: ProcessOutput,
): void => {
  const normalizedLine = output.line.toLocaleLowerCase('en-US');
  if (
    (normalizedLine.includes('certificate chain') &&
      (normalizedLine.includes('invalid') ||
        normalizedLine.includes('not validated') ||
        normalizedLine.includes("isn't validated"))) ||
    normalizedLine.includes('signer certificate is self-signed') ||
    normalizedLine.includes('signer certificate is self signed')
  ) {
    diagnostics.hasCertificateTrustWarning = true;
  }
  if (
    normalizedLine.includes('expired') ||
    normalizedLine.includes('not yet valid') ||
    normalizedLine.includes('disabled')
  ) {
    diagnostics.hasRejectedCertificateWarning = true;
  }
  if (diagnostics.output.length < MAX_AAB_VERIFICATION_OUTPUT_LINES) {
    diagnostics.output.push(output);
  } else {
    diagnostics.isOutputComplete = false;
  }
};

const verifyAabWithJarSigner = async (
  artifactPath: string,
  cwdPath: string,
  executablePath: string,
  signal: AbortSignal,
  onOutput: (output: ProcessOutput) => void,
): Promise<boolean> => {
  const diagnostics: AabVerificationDiagnostics = {
    hasCertificateTrustWarning: false,
    hasRejectedCertificateWarning: false,
    isOutputComplete: true,
    output: [],
  };
  const result = await runExecutable({
    args: [...JAR_SIGNER_ENGLISH_LOCALE_ARGS, '-verify', '-strict', artifactPath],
    cwdPath,
    executablePath,
    onOutput: (output) => inspectAabVerificationOutput(diagnostics, output),
    signal,
  });
  const hasAcceptedCertificateTrustWarning =
    result.exitCode === 4 &&
    diagnostics.isOutputComplete &&
    diagnostics.hasCertificateTrustWarning &&
    !diagnostics.hasRejectedCertificateWarning;
  if (result.exitCode === 0 || hasAcceptedCertificateTrustWarning) {
    onOutput({
      level: 'info',
      line: hasAcceptedCertificateTrustWarning
        ? 'AAB signature and entry integrity verified. The Android signing certificate is self-signed or outside the Java trust store.'
        : 'AAB signature and entry integrity verified.',
    });
    return true;
  }
  for (const output of diagnostics.output) onOutput(output);
  if (!diagnostics.isOutputComplete) {
    onOutput({ level: 'error', line: 'Additional jarsigner verification output was omitted.' });
  }
  return false;
};

const createGradleSigningEnvironment = (
  signing: AndroidSigningSetupConfiguration,
): Readonly<Record<string, string>> => ({
  // Android Studio uses these injected Gradle properties for signed builds. Gradle's
  // environment mapping preserves that behavior without exposing passwords in arguments.
  [GRADLE_SIGNING_KEY_ALIAS_ENV]: signing.keyAlias,
  [GRADLE_SIGNING_KEY_PASSWORD_ENV]: signing.keyPassword,
  [GRADLE_SIGNING_STORE_FILE_ENV]: signing.keystorePath,
  [GRADLE_SIGNING_STORE_PASSWORD_ENV]: signing.storePassword,
});

const countMatches = (contents: string, pattern: RegExp): number => [...contents.matchAll(pattern)].length;

const inspectVersionFile = async (filePath: string): Promise<AndroidVersionFile | null> => {
  let resolvedPath: string;
  try {
    resolvedPath = await resolveExistingFile(filePath, ['.gradle', '.gradle.kts']);
  } catch {
    return null;
  }
  const fileStats = await lstat(resolvedPath);
  if (fileStats.size > MAX_VERSION_FILE_BYTES) {
    throw new Error('The Android Gradle configuration exceeds the supported size.');
  }
  const contents = await readFile(resolvedPath, 'utf8');
  const versionCodeCount = countMatches(contents, VERSION_CODE_PATTERN);
  const versionNameCount = countMatches(contents, VERSION_NAME_PATTERN);
  if (versionCodeCount === 0 && versionNameCount === 0) {
    return null;
  }
  if (versionCodeCount !== 1 || versionNameCount !== 1) {
    throw new Error(
      'The Android version could not be resolved safely. Use one literal versionCode and one literal versionName in the module build.gradle file.',
    );
  }
  await access(resolvedPath, constants.W_OK);
  return { contents, path: resolvedPath };
};

const resolveVersionFile = async (
  configuration: AndroidConfiguration,
): Promise<AndroidVersionFile> => {
  const candidatePaths = [
    path.join(configuration.projectPath, 'app', 'build.gradle'),
    path.join(configuration.projectPath, 'app', 'build.gradle.kts'),
    path.join(configuration.projectPath, 'build.gradle'),
    path.join(configuration.projectPath, 'build.gradle.kts'),
  ];
  const matches: AndroidVersionFile[] = [];
  for (const candidatePath of candidatePaths) {
    const match = await inspectVersionFile(candidatePath);
    if (match !== null) matches.push(match);
  }
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? 'A writable Android module build.gradle file with literal versionCode and versionName values was not found.'
        : 'More than one Android Gradle file defines the application version. Keep the release version in one module build file.',
    );
  }
  const versionFile = matches[0];
  if (versionFile === undefined) {
    throw new Error('The Android version file could not be resolved.');
  }
  return versionFile;
};

const resolveAndroidSdkPath = async (projectPath: string): Promise<string | null> => {
  const configuredSdkPath = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME;
  if (configuredSdkPath !== undefined && configuredSdkPath.trim() !== '') {
    return path.resolve(configuredSdkPath);
  }
  try {
    const localProperties = await readFile(path.join(projectPath, 'local.properties'), 'utf8');
    const sdkDirectory = /^sdk\.dir\s*=\s*(.+)$/mu.exec(localProperties)?.[1]?.trim();
    return sdkDirectory === undefined
      ? null
      : path.resolve(projectPath, sdkDirectory.replace(/\\([\\:= ])/gu, '$1'));
  } catch {
    return null;
  }
};

type AndroidToolCommand = { argsPrefix: string[]; executablePath: string };

const resolveApkSigner = async (projectPath: string): Promise<AndroidToolCommand> => {
  const fromPath = process.platform === 'win32' ? null : await findExecutable('apksigner');
  if (fromPath !== null) return { argsPrefix: [], executablePath: fromPath };
  const sdkPath = await resolveAndroidSdkPath(projectPath);
  if (sdkPath !== null) {
    try {
      const versions = await readdir(path.join(sdkPath, 'build-tools'));
      versions.sort((left, right) => right.localeCompare(left, 'en-US', { numeric: true }));
      for (const version of versions) {
        const toolRootPath = path.join(
          sdkPath,
          'build-tools',
          version,
        );
        try {
          if (process.platform === 'win32') {
            const javaPath = await findExecutable('java');
            if (javaPath === null) throw new Error('java was not found.');
            const jarPath = await resolveExistingFile(path.join(toolRootPath, 'lib', 'apksigner.jar'), ['.jar']);
            return { argsPrefix: ['-jar', jarPath], executablePath: javaPath };
          }
          return {
            argsPrefix: [],
            executablePath: await resolveExecutableFile(path.join(toolRootPath, 'apksigner')),
          };
        } catch {
          // Continue through installed Android build-tools versions.
        }
      }
    } catch {
      // Report one stable tool error below.
    }
  }
  throw new Error('apksigner was not found in PATH or the configured Android SDK.');
};

export class AndroidBuilder {
  public async resolveGradleWrapper(configuration: AndroidConfiguration): Promise<string> {
    const wrapperName = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
    return resolveExecutableFile(path.join(configuration.projectPath, wrapperName));
  }

  public async validateVersionConfiguration(configuration: AndroidConfiguration): Promise<void> {
    await resolveVersionFile(configuration);
  }

  public async validateSigningConfiguration(
    configuration: AndroidConfiguration,
    signing: AndroidSigningSetupConfiguration,
  ): Promise<void> {
    const keytoolPath = await findExecutable('keytool');
    if (keytoolPath === null) throw new Error('keytool was not found. Install a JDK to validate Android signing.');
    const result = await runExecutable({
      args: [
        '-list',
        '-keystore',
        signing.keystorePath,
        '-alias',
        signing.keyAlias,
        '-storepass:env',
        STORE_PASSWORD_ENV,
      ],
      cwdPath: configuration.projectPath,
      environment: { [STORE_PASSWORD_ENV]: signing.storePassword },
      executablePath: keytoolPath,
      onOutput: () => undefined,
      signal: new AbortController().signal,
    });
    if (result.exitCode !== 0) {
      throw new Error('The Android keystore, alias, or store password could not be validated.');
    }
  }

  private async verifyGeneratedSignature(
    configuration: AndroidConfiguration,
    artifactPath: string,
    artifactType: AndroidArtifactType,
    signal: AbortSignal,
    onOutput: (output: ProcessOutput) => void,
  ): Promise<void> {
    if (artifactType === 'apk') {
      const apkSignerPath = await resolveApkSigner(configuration.projectPath);
      const verifyResult = await runExecutable({
        args: [...apkSignerPath.argsPrefix, 'verify', '--verbose', '--print-certs', artifactPath],
        cwdPath: configuration.projectPath,
        executablePath: apkSignerPath.executablePath,
        onOutput,
        signal,
      });
      if (verifyResult.exitCode !== 0) throw new Error('The APK signature could not be verified.');
      return;
    }
    const jarSignerPath = await findExecutable('jarsigner');
    if (jarSignerPath === null) throw new Error('jarsigner was not found. Install a JDK to verify AAB files.');
    const isSignatureValid = await verifyAabWithJarSigner(
      artifactPath,
      configuration.projectPath,
      jarSignerPath,
      signal,
      onOutput,
    );
    if (!isSignatureValid) throw new Error('The AAB signature could not be verified.');
  }

  public async verifySignature(
    configuration: AndroidConfiguration,
    artifactPath: string,
    artifactType: AndroidArtifactType,
  ): Promise<void> {
    const signal = new AbortController().signal;
    try {
      await this.verifyGeneratedSignature(
        configuration,
        artifactPath,
        artifactType,
        signal,
        () => undefined,
      );
    } catch {
      throw new Error(
        `The selected ${artifactType.toUpperCase()} is not signed or its signature is invalid.`,
      );
    }
  }

  public async applyVersion(
    configuration: AndroidConfiguration,
    version: ResolvedAndroidReleaseVersion,
  ): Promise<void> {
    const versionFile = await resolveVersionFile(configuration);
    const withVersionCode = versionFile.contents.replace(
      VERSION_CODE_PATTERN,
      (_match, prefix: string, _currentVersionCode: string, suffix: string) =>
        `${prefix}${version.versionCode}${suffix}`,
    );
    const updatedContents = withVersionCode.replace(
      VERSION_NAME_PATTERN,
      (
        _match,
        prefix: string,
        openingQuote: string,
        _currentVersionName: string,
        suffix: string,
      ) => `${prefix}${openingQuote}${version.versionName}${openingQuote}${suffix}`,
    );
    await replaceTextFileAtomically(versionFile.path, updatedContents);
  }

  public async build(
    configuration: AndroidConfiguration,
    artifactType: AndroidArtifactType,
    signal: AbortSignal,
    onOutput: (output: ProcessOutput) => void,
    signing?: AndroidSigningSetupConfiguration,
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
      environment: signing === undefined ? undefined : createGradleSigningEnvironment(signing),
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
    if (signing !== undefined) {
      await this.verifyGeneratedSignature(
        configuration,
        artifactPath,
        artifactType,
        signal,
        onOutput,
      );
    }
    return artifactPath;
  }
}
