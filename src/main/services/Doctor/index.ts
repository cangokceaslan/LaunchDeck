import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import type { FirebaseCliIntegration } from '@main/integrations/FirebaseCli';
import { findExecutable } from '@main/utils/Executable';
import type { DoctorCheck, DoctorReport } from '@shared/contracts/doctor';

const normalizeOs = (): DoctorReport['os'] => {
  const currentPlatform = platform();
  if (currentPlatform === 'darwin' || currentPlatform === 'linux' || currentPlatform === 'win32') {
    return currentPlatform;
  }
  return 'linux';
};

const isDirectory = async (directoryPath: string): Promise<boolean> => {
  try {
    return (await stat(directoryPath)).isDirectory();
  } catch {
    return false;
  }
};

const resolveAndroidSdkPath = async (os: DoctorReport['os']): Promise<string | null> => {
  const configuredPaths = [process.env.ANDROID_SDK_ROOT, process.env.ANDROID_HOME];
  const conventionalPaths =
    os === 'darwin'
      ? [path.join(homedir(), 'Library', 'Android', 'sdk')]
      : os === 'win32' && process.env.LOCALAPPDATA !== undefined
        ? [path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')]
        : [path.join(homedir(), 'Android', 'Sdk')];
  const candidatePaths = [...configuredPaths, ...conventionalPaths].filter(
    (candidatePath): candidatePath is string =>
      candidatePath !== undefined && candidatePath.trim() !== '',
  );

  for (const candidatePath of candidatePaths) {
    const buildToolsPath = path.join(candidatePath, 'build-tools');
    if (!(await isDirectory(buildToolsPath))) continue;
    try {
      if ((await readdir(buildToolsPath)).length > 0) return candidatePath;
    } catch {
      // Continue through the remaining trusted SDK candidates.
    }
  }
  return null;
};

export class DoctorService {
  public constructor(private readonly firebaseCli: FirebaseCliIntegration) {}

  public async run(): Promise<DoctorReport> {
    const os = normalizeOs();
    const platformCheck: DoctorCheck = {
      code: 'platform',
      detail:
        os === 'darwin'
          ? 'Android and iOS release workflows are available on macOS.'
          : 'Only the Android release workflow is available on this operating system.',
      isBlocking: false,
      label: 'Platform support',
      status: 'passed',
    };
    const firebaseCheck = await this.firebaseCli.diagnose();
    const [javaPath, keytoolPath, jarSignerPath, androidSdkPath] = await Promise.all([
      findExecutable('java'),
      findExecutable('keytool'),
      findExecutable('jarsigner'),
      resolveAndroidSdkPath(os),
    ]);
    const missingJavaTools = [
      javaPath === null ? 'java' : null,
      keytoolPath === null ? 'keytool' : null,
      jarSignerPath === null ? 'jarsigner' : null,
    ].filter((tool): tool is string => tool !== null);
    const javaCheck: DoctorCheck = {
      code: 'java',
      detail:
        missingJavaTools.length === 0
          ? `Java and Android signing tools are ready: ${javaPath}`
          : `Install a JDK and expose the missing tools in PATH: ${missingJavaTools.join(', ')}.`,
      isBlocking: false,
      label: 'Java / JDK',
      status: missingJavaTools.length === 0 ? 'passed' : 'warning',
    };
    const androidSdkCheck: DoctorCheck = {
      code: 'androidSdk',
      detail:
        androidSdkPath === null
          ? 'Android SDK build-tools were not found globally. An application may still provide an SDK through local.properties.'
          : `Android SDK build-tools are available: ${androidSdkPath}`,
      isBlocking: false,
      label: 'Android SDK',
      status: androidSdkPath === null ? 'warning' : 'passed',
    };
    const xcodePath = os === 'darwin' ? await findExecutable('xcodebuild') : null;
    const xcodeCheck: DoctorCheck = {
      code: 'xcode',
      detail:
        os !== 'darwin'
          ? 'iOS builds are not supported on this platform.'
          : xcodePath === null
            ? 'Xcode Command Line Tools were not found. Android is available, but iOS builds are unavailable.'
            : `iOS build tool ready: ${xcodePath}`,
      isBlocking: false,
      label: 'Xcode',
      status: os === 'darwin' && xcodePath !== null ? 'passed' : 'warning',
    };
    const checks = [firebaseCheck, javaCheck, androidSdkCheck, platformCheck, xcodeCheck];
    return {
      checks,
      isReady: !checks.some((check) => check.isBlocking && check.status === 'failed'),
      os,
      supportedPlatforms: os === 'darwin' ? ['android', 'ios'] : ['android'],
    };
  }
}
