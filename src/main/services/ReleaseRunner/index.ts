import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, copyFile, lstat, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import type { AndroidBuilder } from '@main/services/AndroidBuilder';
import type { IosBuilder } from '@main/services/IosBuilder';
import type { FirebaseCliIntegration } from '@main/integrations/FirebaseCli';
import type { ApplicationRepository } from '@main/repositories/Application';
import type { RunHistoryRepository } from '@main/repositories/RunHistory';
import { runExecutable } from '@main/utils/ChildProcess';
import { resolveCommandLine } from '@main/utils/CommandLine';
import {
  resolveExistingDirectory,
  resolveExistingFile,
  resolveWritableDirectory,
} from '@main/utils/FileSystem';
import { createRedactor } from '@main/utils/Redaction';
import type {
  ActiveReleaseRun,
  InternalReleasePlan,
} from '@main/services/ReleaseRunner/index.types';
import type {
  PipelineHook,
  ReleaseMode,
  ReleasePlatform,
} from '@shared/contracts/domain';
import type {
  CancelReleaseResult,
  PlatformReleaseResult,
  PreflightReleaseRequest,
  PreflightResult,
  ReleaseEvent,
  ReleasePhase,
  ReleaseProgressKind,
  ReleaseResult,
  ResolvedReleasePlan,
  StartReleaseResult,
  ValidationIssue,
} from '@shared/contracts/release';

const PLAN_LIFETIME_MS = 10 * 60 * 1_000;
const GROUP_ALIAS_PATTERN = /^[a-z0-9][a-z0-9_-]*$/u;

const includesBuild = (mode: ReleaseMode): boolean =>
  mode === 'buildOnly' || mode === 'buildAndUpload';
const includesUpload = (mode: ReleaseMode): boolean =>
  mode === 'uploadOnly' || mode === 'buildAndUpload';

const formatArtifactTimestamp = (isoTimestamp: string): string => {
  const timestamp = new Date(isoTimestamp);
  const date = [timestamp.getUTCFullYear(), timestamp.getUTCMonth() + 1, timestamp.getUTCDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
    .join('');
  const time = [timestamp.getUTCHours(), timestamp.getUTCMinutes(), timestamp.getUTCSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join('');
  return `${date}-${time}-${String(timestamp.getUTCMilliseconds()).padStart(3, '0')}`;
};

const sanitizeArtifactName = (applicationName: string): string => {
  const sanitizedName = applicationName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 64);
  return sanitizedName === '' ? 'application' : sanitizedName;
};

const saveLocalArtifact = async (
  sourceArtifactPath: string,
  outputDirectoryPath: string,
  applicationName: string,
  platform: ReleasePlatform,
  startedAt: string,
): Promise<string> => {
  const directoryPath = await resolveWritableDirectory(outputDirectoryPath);
  const extension = path.extname(sourceArtifactPath).toLocaleLowerCase('en-US');
  const destinationPath = path.join(
    directoryPath,
    `${sanitizeArtifactName(applicationName)}-${platform}-${formatArtifactTimestamp(startedAt)}${extension}`,
  );
  let isDestinationCreated = false;
  try {
    await copyFile(sourceArtifactPath, destinationPath, constants.COPYFILE_EXCL);
    isDestinationCreated = true;
    await chmod(destinationPath, 0o600);
    const resolvedPath = await resolveExistingFile(destinationPath, [extension]);
    const artifactStats = await lstat(resolvedPath);
    if (artifactStats.size === 0) {
      throw new Error('The saved local artifact is empty.');
    }
    return resolvedPath;
  } catch (error) {
    if (isDestinationCreated) {
      await rm(destinationPath, { force: true });
    }
    throw error;
  }
};

const hooksFor = (
  hooks: PipelineHook[],
  phase: PipelineHook['phase'],
  platform: ReleasePlatform,
): PipelineHook[] =>
  hooks.filter(
    (hook) => hook.isEnabled && hook.phase === phase && (hook.platform === 'all' || hook.platform === platform),
  );

const countPlatformSteps = (
  hooks: PipelineHook[],
  mode: ReleaseMode,
  platform: ReleasePlatform,
): number => {
  const buildSteps = includesBuild(mode)
    ? hooksFor(hooks, 'preBuild', platform).length +
      1 +
      hooksFor(hooks, 'postBuild', platform).length
    : 0;
  const uploadSteps = includesUpload(mode)
    ? hooksFor(hooks, 'preUpload', platform).length +
      1 +
      hooksFor(hooks, 'postUpload', platform).length
    : 0;
  const localSaveSteps = mode === 'buildOnly' ? 1 : 0;
  return buildSteps + uploadSteps + localSaveSteps + 1;
};

const safeErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'An unexpected operation error occurred.';

const readReportedPercent = (line: string): number | null => {
  const match = /(?:^|[\s[(])(\d{1,3})%(?:[\s\])]|$)/u.exec(line);
  if (match?.[1] === undefined) return null;
  const percent = Number(match[1]);
  return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : null;
};

export class ReleaseRunner {
  private readonly plans = new Map<string, InternalReleasePlan>();
  private activeRun: ActiveReleaseRun | null = null;

  public constructor(
    private readonly applications: ApplicationRepository,
    private readonly history: RunHistoryRepository,
    private readonly firebaseCli: FirebaseCliIntegration,
    private readonly androidBuilder: AndroidBuilder,
    private readonly iosBuilder: IosBuilder,
    private readonly runsRootPath: string,
  ) {}

  public hasActiveRun(): boolean {
    return this.activeRun !== null;
  }

  private async validatePlatform(
    planRequest: PreflightReleaseRequest,
    application: InternalReleasePlan['application'],
    platform: ReleasePlatform,
    issues: ValidationIssue[],
    artifactPaths: InternalReleasePlan['artifactPaths'],
  ): Promise<void> {
    if (platform === 'ios' && process.platform !== 'darwin') {
      issues.push({
        code: 'platformUnsupported',
        message: 'iOS releases can run only on macOS.',
        severity: 'error',
      });
      return;
    }
    const configuration = platform === 'android' ? application.android : application.ios;
    if (configuration === null) {
      issues.push({
        code: 'invalidConfiguration',
        message: `${platform === 'android' ? 'Android' : 'iOS'} setup is incomplete for this application.`,
        severity: 'error',
      });
      return;
    }
    try {
      await resolveExistingDirectory(configuration.projectPath);
      if (includesBuild(planRequest.mode)) {
        if (platform === 'android' && application.android !== null) {
          await this.androidBuilder.resolveGradleWrapper(application.android);
        }
        if (platform === 'ios') {
          await this.iosBuilder.resolveXcodeBuild();
        }
      }
      const requestedArtifactPath =
        platform === 'android' ? planRequest.androidArtifactPath : planRequest.iosArtifactPath;
      if (planRequest.mode === 'uploadOnly') {
        artifactPaths[platform] = await resolveExistingFile(
          requestedArtifactPath ?? configuration.artifactPath,
          platform === 'android' ? ['.apk', '.aab'] : ['.ipa'],
        );
      } else {
        artifactPaths[platform] =
          platform === 'android' && application.android !== null
            ? (planRequest.androidArtifactType ?? application.android.defaultArtifactType) === 'aab'
              ? application.android.aabArtifactPath
              : application.android.artifactPath
            : configuration.artifactPath;
      }
      const relevantHooks = application.hooks.filter(
        (hook) =>
          hook.isEnabled &&
          (hook.platform === 'all' || hook.platform === platform) &&
          ((includesBuild(planRequest.mode) &&
            (hook.phase === 'preBuild' || hook.phase === 'postBuild')) ||
            (includesUpload(planRequest.mode) &&
              (hook.phase === 'preUpload' || hook.phase === 'postUpload'))),
      );
      await Promise.all(
        relevantHooks.map(async (hook) => {
          const cwdPath = await resolveExistingDirectory(hook.cwdPath);
          await resolveCommandLine(hook.command, cwdPath);
        }),
      );
    } catch (error) {
      issues.push({
        code: 'pathMissing',
        message: safeErrorMessage(error),
        severity: 'error',
      });
    }
  }

  public async preflight(request: PreflightReleaseRequest): Promise<PreflightResult> {
    const issues: ValidationIssue[] = [];
    const application = this.applications.getStored(request.applicationId);
    if (application === null) {
      return {
        isValid: false,
        issues: [{ code: 'applicationNotFound', message: 'Application not found.', severity: 'error' }],
      };
    }
    if (new Set(request.platforms).size !== request.platforms.length) {
      issues.push({
        code: 'invalidConfiguration',
        message: 'The same platform cannot be selected more than once.',
        severity: 'error',
      });
    }
    const invalidGroup = includesUpload(request.mode)
      ? request.distributionGroups.find((group) => !GROUP_ALIAS_PATTERN.test(group))
      : undefined;
    if (invalidGroup !== undefined) {
      issues.push({
        code: 'invalidConfiguration',
        field: 'distributionGroups',
        message: `Invalid tester group alias: ${invalidGroup}`,
        severity: 'error',
      });
    }
    const artifactPaths: InternalReleasePlan['artifactPaths'] = {};
    let artifactOutputDirectoryPath: string | undefined;
    if (request.mode === 'buildOnly') {
      try {
        artifactOutputDirectoryPath = await resolveWritableDirectory(
          request.artifactOutputDirectoryPath ?? application.artifactOutputDirectoryPath ?? '',
        );
      } catch (error) {
        issues.push({
          code: 'outputDirectoryUnavailable',
          field: 'artifactOutputDirectoryPath',
          message: `The local artifact output directory is unavailable: ${safeErrorMessage(error)}`,
          severity: 'error',
        });
      }
    }
    await Promise.all(
      request.platforms.map((platform) =>
        this.validatePlatform(request, application, platform, issues, artifactPaths),
      ),
    );
    if (includesUpload(request.mode)) {
      try {
        await resolveExistingFile(application.serviceAccountPath, ['.json']);
        if ((await this.firebaseCli.getExecutablePath()) === null) {
          issues.push({
            code: 'firebaseCliMissing',
            message: 'Firebase CLI was not found.',
            severity: 'error',
          });
        } else {
          await this.firebaseCli.validateAccess({
            credentialPath: application.serviceAccountPath,
            cwdPath: application.android?.projectPath ?? application.ios?.projectPath ?? process.cwd(),
            onOutput: () => undefined,
            projectId: application.firebaseProjectId,
            signal: new AbortController().signal,
          });
        }
      } catch {
        issues.push({
          code: 'firebaseAccessDenied',
          message: 'The Firebase project could not be accessed with the service account.',
          severity: 'error',
        });
      }
    }
    if (issues.some((issue) => issue.severity === 'error')) {
      return { isValid: false, issues };
    }
    const planId = randomUUID();
    const phaseCount = request.platforms.reduce(
      (total, platform) => total + countPlatformSteps(application.hooks, request.mode, platform),
      0,
    );
    const resolvedAndroidArtifactType = request.platforms.includes('android')
      ? request.mode === 'uploadOnly' && artifactPaths.android !== undefined
        ? artifactPaths.android.toLowerCase().endsWith('.aab')
          ? 'aab'
          : 'apk'
        : request.androidArtifactType ?? application.android?.defaultArtifactType ?? 'apk'
      : undefined;
    const publicPlan: ResolvedReleasePlan = {
      androidArtifactType: resolvedAndroidArtifactType,
      applicationId: application.id,
      applicationName: application.name,
      artifactOutputDirectoryPath,
      distributionGroups: [...request.distributionGroups],
      expiresAt: new Date(Date.now() + PLAN_LIFETIME_MS).toISOString(),
      mode: request.mode,
      phaseCount,
      planId,
      platforms: [...request.platforms],
      releaseNotes: request.releaseNotes,
    };
    this.plans.set(planId, {
      application,
      artifactPaths,
      publicPlan,
      request: {
        ...request,
        distributionGroups: [...request.distributionGroups],
        platforms: [...request.platforms],
      },
    });
    const warnings: ValidationIssue[] = application.hooks.some(
      (hook) =>
        hook.isEnabled &&
        ((includesBuild(request.mode) &&
          (hook.phase === 'preBuild' || hook.phase === 'postBuild')) ||
          (includesUpload(request.mode) &&
            (hook.phase === 'preUpload' || hook.phase === 'postUpload'))),
    )
      ? [
          {
            code: 'invalidConfiguration',
            message: 'Enabled custom pipeline commands will run in the selected working directories.',
            severity: 'warning',
          },
        ]
      : [];
    return { isValid: true, plan: publicPlan, warnings };
  }

  public start(planId: string, onEvent: (event: ReleaseEvent) => void): StartReleaseResult {
    if (this.activeRun !== null) {
      return {
        error: {
          code: 'activeRunExists',
          message: 'Another release is already running.',
          retryable: true,
        },
        started: false,
      };
    }
    const plan = this.plans.get(planId);
    if (plan === undefined || Date.parse(plan.publicPlan.expiresAt) <= Date.now()) {
      this.plans.delete(planId);
      return {
        error: {
          code: 'planExpired',
          message: 'The preflight plan has expired. Validate it again.',
          retryable: true,
        },
        started: false,
      };
    }
    const runId = randomUUID();
    const abortController = new AbortController();
    this.activeRun = { abortController, runId };
    this.plans.delete(planId);
    void this.execute(plan, runId, abortController, onEvent);
    return { runId, started: true };
  }

  private async execute(
    plan: InternalReleasePlan,
    runId: string,
    abortController: AbortController,
    onEvent: (event: ReleaseEvent) => void,
  ): Promise<void> {
    const startedAt = new Date().toISOString();
    const runWorkspacePath = path.join(this.runsRootPath, runId);
    await mkdir(runWorkspacePath, { mode: 0o700, recursive: true });
    const redact = createRedactor([plan.application.serviceAccountPath]);
    let sequence = 0;
    let completedPhases = 0;
    let lastEmittedPercent = 0;
    let lastProgressKind: ReleaseProgressKind = 'verified';
    let activePhase: ReleasePhase = 'validating';
    const emitLog = (
      message: string,
      level: 'info' | 'warning' | 'error' = 'info',
      platform?: ReleasePlatform,
    ): void => {
      sequence += 1;
      onEvent({
        entry: {
          level,
          message: redact(message),
          phase: activePhase,
          platform,
          sequence,
          timestamp: new Date().toISOString(),
        },
        runId,
        type: 'logReceived',
      });
    };
    const runStep = async (
      phase: ReleasePhase,
      platform: ReleasePlatform,
      label: string,
      operation: (reportActivity: (line?: string) => void) => Promise<void>,
    ): Promise<void> => {
      activePhase = phase;
      let activityCount = 0;
      let stepFraction = 0;
      const emitProgress = (progressKind: ReleaseProgressKind): void => {
        const calculatedPercent = Math.min(
          99,
          Math.round(
            ((completedPhases + stepFraction) / plan.publicPlan.phaseCount) * 100,
          ),
        );
        if (calculatedPercent > lastEmittedPercent) {
          lastEmittedPercent = calculatedPercent;
          lastProgressKind = progressKind;
        }
        onEvent({
          activePhase,
          completedPhases,
          percent: lastEmittedPercent,
          platform,
          progressKind: lastProgressKind,
          runId,
          totalPhases: plan.publicPlan.phaseCount,
          type: 'phaseChanged',
        });
      };
      const reportActivity = (line?: string): void => {
        activityCount += 1;
        const reportedPercent = line === undefined ? null : readReportedPercent(line);
        const nextFraction =
          reportedPercent === null
            ? Math.min(0.9, 0.08 + (1 - Math.exp(-activityCount / 18)) * 0.82)
            : Math.min(0.95, reportedPercent / 100);
        if (nextFraction <= stepFraction) return;
        stepFraction = nextFraction;
        emitProgress(reportedPercent === null ? 'estimated' : 'reported');
      };
      emitProgress('verified');
      emitLog(label, 'info', platform);
      const activityTimer = setInterval(() => reportActivity(), 1_000);
      try {
        await operation(reportActivity);
      } finally {
        clearInterval(activityTimer);
      }
      completedPhases += 1;
      stepFraction = 0;
      const verifiedPercent = Math.round(
        (completedPhases / plan.publicPlan.phaseCount) * 100,
      );
      if (verifiedPercent >= lastEmittedPercent) {
        lastEmittedPercent = verifiedPercent;
        lastProgressKind = 'verified';
      }
      onEvent({
        activePhase,
        completedPhases,
        percent: lastEmittedPercent,
        platform,
        progressKind: lastProgressKind,
        runId,
        totalPhases: plan.publicPlan.phaseCount,
        type: 'phaseChanged',
      });
    };
    const runHooks = async (
      hookPhase: PipelineHook['phase'],
      platform: ReleasePlatform,
    ): Promise<void> => {
      const phase: ReleasePhase = hookPhase;
      for (const hook of hooksFor(plan.application.hooks, hookPhase, platform)) {
        await runStep(phase, platform, `Custom step: ${hook.name}`, async (reportActivity) => {
          const command = await resolveCommandLine(hook.command, hook.cwdPath);
          const result = await runExecutable({
            args: command.args,
            cwdPath: hook.cwdPath,
            executablePath: command.executablePath,
            onOutput: ({ level, line }) => {
              reportActivity(line);
              emitLog(line, level === 'error' ? 'error' : 'info', platform);
            },
            signal: abortController.signal,
          });
          if (result.exitCode !== 0) {
            throw new Error(`${hook.name} failed with exit code ${result.exitCode}.`);
          }
        });
      }
    };
    const platformResults: PlatformReleaseResult[] = [];
    try {
      for (const platform of plan.request.platforms) {
        let artifactPath = plan.artifactPaths[platform];
        let failureArea: 'build' | 'upload' = includesBuild(plan.request.mode) ? 'build' : 'upload';
        const platformResult: PlatformReleaseResult = {
          buildStatus: includesBuild(plan.request.mode) ? 'failed' : 'notRequested',
          platform,
          uploadStatus: includesUpload(plan.request.mode) ? 'failed' : 'notRequested',
        };
        platformResults.push(platformResult);
        try {
          if (includesBuild(plan.request.mode)) {
            await runHooks('preBuild', platform);
            await runStep('build', platform, `${platform === 'android' ? 'Android' : 'iOS'} build started.`, async (reportActivity) => {
              if (platform === 'android' && plan.application.android !== null) {
                artifactPath = await this.androidBuilder.build(
                  plan.application.android,
                  plan.publicPlan.androidArtifactType ?? plan.application.android.defaultArtifactType,
                  abortController.signal,
                  ({ level, line }) => {
                    reportActivity(line);
                    emitLog(line, level === 'error' ? 'error' : 'info', platform);
                  },
                );
              } else if (platform === 'ios' && plan.application.ios !== null) {
                artifactPath = await this.iosBuilder.build(
                  plan.application.ios,
                  path.join(runWorkspacePath, 'ios'),
                  abortController.signal,
                  ({ level, line }) => {
                    reportActivity(line);
                    emitLog(line, level === 'error' ? 'error' : 'info', platform);
                  },
                );
              } else {
                throw new Error('Platform build configuration was not found.');
              }
              platformResult.buildStatus = 'succeeded';
            });
            await runHooks('postBuild', platform);
          }
          await runStep('verifying', platform, 'Verifying artifact.', async () => {
            if (artifactPath === undefined) {
              throw new Error('Artifact path could not be resolved.');
            }
            artifactPath = await resolveExistingFile(
              artifactPath,
              platform === 'android' ? ['.apk', '.aab'] : ['.ipa'],
            );
            platformResult.artifactPath = artifactPath;
          });
          if (plan.request.mode === 'buildOnly') {
            await runStep('saving', platform, 'Saving artifact to the selected output directory.', async () => {
              if (artifactPath === undefined || plan.publicPlan.artifactOutputDirectoryPath === undefined) {
                throw new Error('The local artifact output configuration is incomplete.');
              }
              artifactPath = await saveLocalArtifact(
                artifactPath,
                plan.publicPlan.artifactOutputDirectoryPath,
                plan.application.name,
                platform,
                startedAt,
              );
              platformResult.artifactPath = artifactPath;
            });
          }
          if (includesUpload(plan.request.mode)) {
            failureArea = 'upload';
            await runHooks('preUpload', platform);
            await runStep('upload', platform, 'Firebase App Distribution upload started.', async (reportActivity) => {
              const platformConfiguration =
                platform === 'android' ? plan.application.android : plan.application.ios;
              if (platformConfiguration === null || artifactPath === undefined) {
                throw new Error('Upload configuration is incomplete.');
              }
              const uploadedArtifactPath = artifactPath;
              let uploadError: unknown;
              try {
                await this.firebaseCli.upload({
                  appId: platformConfiguration.firebaseAppId,
                  artifactPath: uploadedArtifactPath,
                  credentialPath: plan.application.serviceAccountPath,
                  cwdPath: platformConfiguration.projectPath,
                  groups: plan.request.distributionGroups,
                  onOutput: ({ level, line }) => {
                    reportActivity(line);
                    emitLog(line, level === 'error' ? 'error' : 'info', platform);
                  },
                  projectId: plan.application.firebaseProjectId,
                  releaseNotes: plan.request.releaseNotes,
                  signal: abortController.signal,
                });
              } catch (error) {
                uploadError = error;
              }
              if (plan.request.mode === 'buildAndUpload') {
                try {
                  await rm(uploadedArtifactPath, { force: true });
                  artifactPath = undefined;
                  platformResult.artifactPath = undefined;
                  emitLog('Temporary build artifact removed after Firebase distribution.', 'info', platform);
                } catch (cleanupError) {
                  const cleanupMessage = `The temporary build artifact could not be deleted: ${safeErrorMessage(cleanupError)}`;
                  throw uploadError === undefined
                    ? new Error(cleanupMessage)
                    : new Error(`${safeErrorMessage(uploadError)} ${cleanupMessage}`);
                }
              }
              if (uploadError !== undefined) {
                throw uploadError;
              }
              platformResult.uploadStatus = 'succeeded';
            });
            await runHooks('postUpload', platform);
          }
          emitLog('Platform pipeline completed.', 'info', platform);
        } catch (error) {
          if (abortController.signal.aborted) {
            throw error;
          }
          platformResult.failedPhase = activePhase;
          platformResult.errorMessage = redact(safeErrorMessage(error));
          if (failureArea === 'build' && platformResult.buildStatus === 'succeeded') {
            platformResult.buildStatus = 'failed';
          }
          if (failureArea === 'upload' && platformResult.uploadStatus === 'succeeded') {
            platformResult.uploadStatus = 'failed';
          }
          emitLog(platformResult.errorMessage, 'error', platform);
        }
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        emitLog(safeErrorMessage(error), 'error');
      }
    } finally {
      const isCancelled = abortController.signal.aborted;
      const succeededPlatforms = platformResults.filter(
        (result) =>
          result.errorMessage === undefined &&
          result.buildStatus !== 'failed' &&
          result.uploadStatus !== 'failed',
      ).length;
      const outcome: ReleaseResult['outcome'] = isCancelled
        ? 'cancelled'
        : succeededPlatforms === platformResults.length
          ? 'succeeded'
          : succeededPlatforms > 0
            ? 'partiallySucceeded'
            : 'failed';
      const result: ReleaseResult = {
        applicationId: plan.application.id,
        finishedAt: new Date().toISOString(),
        mode: plan.request.mode,
        outcome,
        platforms: platformResults,
        runId,
        startedAt,
      };
      try {
        this.history.add(result);
        onEvent({ result, runId, type: 'releaseFinished' });
      } finally {
        try {
          await rm(runWorkspacePath, { force: true, recursive: true });
        } finally {
          if (this.activeRun?.runId === runId) {
            this.activeRun = null;
          }
        }
      }
    }
  }

  public async cancel(runId: string): Promise<CancelReleaseResult> {
    if (this.activeRun?.runId !== runId) {
      return { cancelled: false, runId };
    }
    this.activeRun.abortController.abort();
    return { cancelled: true, runId };
  }

  public async cancelActive(): Promise<void> {
    this.activeRun?.abortController.abort();
  }
}
