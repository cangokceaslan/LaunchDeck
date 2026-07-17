import type { DoctorCheck } from '@shared/contracts/doctor';
import { findExecutable } from '@main/utils/Executable';
import { runExecutable } from '@main/utils/ChildProcess';
import type { ProcessOutput } from '@main/utils/ChildProcess/index.types';

export type FirebaseUploadInput = {
  appId: string;
  artifactPath: string;
  credentialPath: string;
  cwdPath: string;
  groups: string[];
  onOutput: (output: ProcessOutput) => void;
  projectId: string;
  releaseNotes: string;
  signal: AbortSignal;
};

export class FirebaseCliIntegration {
  private executablePath: string | null = null;

  public async getExecutablePath(): Promise<string | null> {
    this.executablePath ??= await findExecutable('firebase');
    return this.executablePath;
  }

  public async diagnose(): Promise<DoctorCheck> {
    const executablePath = await this.getExecutablePath();
    if (executablePath === null) {
      return {
        code: 'firebaseCli',
        detail: 'Firebase CLI was not found. Firebase App Distribution is unavailable; artifact and store workflows remain available.',
        isBlocking: false,
        label: 'Firebase CLI',
        status: 'warning',
      };
    }
    const outputLines: string[] = [];
    const result = await runExecutable({
      args: ['--version'],
      cwdPath: process.cwd(),
      executablePath,
      onOutput: ({ line }) => outputLines.push(line),
      signal: new AbortController().signal,
    });
    if (result.exitCode !== 0) {
      return {
        code: 'firebaseCli',
        detail: 'Firebase CLI ran, but its version information could not be retrieved.',
        isBlocking: false,
        label: 'Firebase CLI',
        status: 'warning',
      };
    }
    return {
      code: 'firebaseCli',
      detail: `Ready: ${executablePath}`,
      isBlocking: false,
      label: 'Firebase CLI',
      status: 'passed',
      version: outputLines.at(-1)?.trim() || 'Unknown',
    };
  }

  private async runAuthenticated(
    args: readonly string[],
    input: Pick<FirebaseUploadInput, 'credentialPath' | 'cwdPath' | 'onOutput' | 'signal'>,
  ): Promise<void> {
    const executablePath = await this.getExecutablePath();
    if (executablePath === null) {
      throw new Error('Firebase CLI was not found.');
    }
    const isolatedConfigHome = await mkdtemp(path.join(tmpdir(), 'launchdeck-firebase-'));
    try {
      const result = await runExecutable({
        args,
        cwdPath: input.cwdPath,
        environment: {
          CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE: input.credentialPath,
          GOOGLE_APPLICATION_CREDENTIALS: input.credentialPath,
          XDG_CONFIG_HOME: isolatedConfigHome,
        },
        executablePath,
        onOutput: input.onOutput,
        signal: input.signal,
      });
      if (result.exitCode !== 0) {
        throw new Error(`Firebase CLI exited with code ${result.exitCode}.`);
      }
    } finally {
      await rm(isolatedConfigHome, { force: true, recursive: true });
    }
  }

  public async validateAccess(
    input: Pick<FirebaseUploadInput, 'credentialPath' | 'cwdPath' | 'onOutput' | 'projectId' | 'signal'>,
  ): Promise<void> {
    await this.runAuthenticated(
      ['apps:list', '--project', input.projectId, '--json'],
      input,
    );
  }

  public async upload(input: FirebaseUploadInput): Promise<void> {
    await this.runAuthenticated(
      [
        'appdistribution:distribute',
        input.artifactPath,
        '--app',
        input.appId,
        '--project',
        input.projectId,
        '--groups',
        input.groups.join(','),
        '--release-notes',
        input.releaseNotes,
      ],
      input,
    );
  }
}
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
