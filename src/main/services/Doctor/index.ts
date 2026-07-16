import { platform } from 'node:os';
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
    const checks = [firebaseCheck, platformCheck, xcodeCheck];
    return {
      checks,
      isReady: !checks.some((check) => check.isBlocking && check.status === 'failed'),
      os,
      supportedPlatforms: os === 'darwin' ? ['android', 'ios'] : ['android'],
    };
  }
}
