import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, copyFile, lstat, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import type { AndroidBuilder } from '@main/services/AndroidBuilder';
import type { IosBuilder } from '@main/services/IosBuilder';
import type { FirebaseCliIntegration } from '@main/integrations/FirebaseCli';
import type { AppStoreConnectIntegration } from '@main/integrations/AppStoreConnect';
import type { GooglePlayIntegration } from '@main/integrations/GooglePlay';
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
  ReleaseCompletionNotifier,
} from '@main/services/ReleaseRunner/index.types';
import type {
  PipelineHook,
  DistributionDestination,
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
  ResolvedReleaseVersion,
  StartReleaseResult,
  ValidationIssue,
} from '@shared/contracts/release';

const PLAN_LIFETIME_MS = 10 * 60 * 1_000;
const GROUP_ALIAS_PATTERN = /^[a-z0-9][a-z0-9_-]*$/u;

const includesBuild = (mode: ReleaseMode): boolean =>
  mode === 'buildOnly' || mode === 'buildAndUpload';
const includesUpload = (mode: ReleaseMode): boolean =>
  mode === 'uploadOnly' || mode === 'buildAndUpload';
const hasDestination = (
  destinations: DistributionDestination[],
  destination: DistributionDestination,
): boolean => destinations.includes(destination);

const shouldSignBuild = (
  request: PreflightReleaseRequest,
  application: InternalReleasePlan['application'],
  platform: ReleasePlatform,
): boolean => {
  if (hasDestination(request.destinations, 'store')) return true;
  if (hasDestination(request.destinations, 'firebase')) {
    const isFirebaseSigningRequired = platform === 'android'
      ? application.firebaseDistribution.requiresAndroidSigning
      : application.firebaseDistribution.requiresIosSigning;
    if (isFirebaseSigningRequired) return true;
  }
  if (!hasDestination(request.destinations, 'artifact')) return false;
  const isSigningRequiredBySetup = platform === 'android'
    ? application.artifactGeneration.requiresAndroidSigning
    : application.artifactGeneration.requiresIosSigning;
  return isSigningRequiredBySetup || request.artifactSigningPlatforms.includes(platform);
};

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
  destinations: DistributionDestination[],
): number => {
  const buildSteps = includesBuild(mode)
    ? hooksFor(hooks, 'preBuild', platform).length +
      2 +
      hooksFor(hooks, 'postBuild', platform).length
    : 0;
  const uploadCount = Number(hasDestination(destinations, 'firebase')) + Number(hasDestination(destinations, 'store'));
  const uploadSteps = includesUpload(mode) && uploadCount > 0
    ? hooksFor(hooks, 'preUpload', platform).length +
      uploadCount +
      hooksFor(hooks, 'postUpload', platform).length
    : 0;
  const localSaveSteps = hasDestination(destinations, 'artifact') ? 1 : 0;
  return buildSteps + uploadSteps + localSaveSteps + 1;
};

const PHASE_PROGRESS_WEIGHTS = {
  build: 60,
  postBuild: 3,
  postUpload: 3,
  preBuild: 3,
  preUpload: 3,
  saving: 5,
  storeUpload: 12,
  upload: 12,
  validating: 1,
  verifying: 5,
  versioning: 3,
} as const satisfies Record<ReleasePhase, number>;

const getPlatformProgressWeight = (
  hooks: PipelineHook[],
  mode: ReleaseMode,
  platform: ReleasePlatform,
  destinations: DistributionDestination[],
): number => {
  const buildWeight = includesBuild(mode)
    ? PHASE_PROGRESS_WEIGHTS.versioning +
      PHASE_PROGRESS_WEIGHTS.build +
      hooksFor(hooks, 'preBuild', platform).length * PHASE_PROGRESS_WEIGHTS.preBuild +
      hooksFor(hooks, 'postBuild', platform).length * PHASE_PROGRESS_WEIGHTS.postBuild
    : 0;
  const hasUploadDestination =
    hasDestination(destinations, 'firebase') || hasDestination(destinations, 'store');
  const uploadWeight = includesUpload(mode) && hasUploadDestination
    ? hooksFor(hooks, 'preUpload', platform).length * PHASE_PROGRESS_WEIGHTS.preUpload +
      hooksFor(hooks, 'postUpload', platform).length * PHASE_PROGRESS_WEIGHTS.postUpload +
      Number(hasDestination(destinations, 'firebase')) * PHASE_PROGRESS_WEIGHTS.upload +
      Number(hasDestination(destinations, 'store')) * PHASE_PROGRESS_WEIGHTS.storeUpload
    : 0;
  const localSaveWeight = hasDestination(destinations, 'artifact')
    ? PHASE_PROGRESS_WEIGHTS.saving
    : 0;
  return buildWeight + uploadWeight + localSaveWeight + PHASE_PROGRESS_WEIGHTS.verifying;
};

const safeErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'An unexpected operation error occurred.';

const resolveReleaseVersion = (
  request: PreflightReleaseRequest,
): ResolvedReleaseVersion | undefined => {
  if (!includesBuild(request.mode) || request.version === undefined) return undefined;
  const resolveVersionName = (versionName: string, incrementPatch: boolean): string => {
    const versionComponents = versionName.trim().split('.').map(Number);
    const major = versionComponents[0];
    const minor = versionComponents[1];
    const patch = versionComponents[2];
    if (major === undefined || minor === undefined || patch === undefined) {
      throw new Error('The release version is incomplete.');
    }
    return `${major}.${minor}.${patch + (incrementPatch ? 1 : 0)}`;
  };

  return {
    android:
      request.version.android === undefined
        ? undefined
        : {
            versionCode:
              request.version.android.versionCode +
              (request.version.android.incrementVersionCode ? 1 : 0),
            versionName: resolveVersionName(
              request.version.android.versionName,
              request.version.android.incrementPatch,
            ),
          },
    ios:
      request.version.ios === undefined
        ? undefined
        : {
            buildNumber:
              request.version.ios.buildNumber +
              (request.version.ios.incrementBuildNumber ? 1 : 0),
            versionName: resolveVersionName(
              request.version.ios.versionName,
              request.version.ios.incrementPatch,
            ),
          },
  };
};

export class ReleaseRunner {
  private readonly plans = new Map<string, InternalReleasePlan>();
  private activeRun: ActiveReleaseRun | null = null;

  public constructor(
    private readonly applications: ApplicationRepository,
    private readonly history: RunHistoryRepository,
    private readonly firebaseCli: FirebaseCliIntegration,
    private readonly googlePlay: GooglePlayIntegration,
    private readonly appStoreConnect: AppStoreConnectIntegration,
    private readonly androidBuilder: AndroidBuilder,
    private readonly iosBuilder: IosBuilder,
    private readonly runsRootPath: string,
    private readonly notifyReleaseCompletion: ReleaseCompletionNotifier,
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
          await this.androidBuilder.validateVersionConfiguration(application.android);
          const requiresSigning = shouldSignBuild(planRequest, application, platform);
          if (requiresSigning) {
            if (application.androidSigning === null) throw new Error('Android signing configuration is required.');
            await this.androidBuilder.validateSigningConfiguration(application.android, application.androidSigning);
          }
        }
        if (platform === 'ios' && application.ios !== null) {
          await this.iosBuilder.resolveXcodeBuild();
          await this.iosBuilder.validateVersionConfiguration(application.ios);
          if (
            shouldSignBuild(planRequest, application, platform) &&
            (!application.iosSigning.isEnabled || application.iosSigning.developmentTeamId === '')
          ) {
            throw new Error('Automatic iOS signing and a development team ID are required.');
          }
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
      if (hasDestination(planRequest.destinations, 'store')) {
        if (platform === 'android') {
          if (application.android === null || application.googlePlay === null) {
            throw new Error('Google Play distribution configuration is incomplete.');
          }
          await resolveExistingFile(application.googlePlay.serviceAccountPath, ['.json']);
          await this.googlePlay.validateAccess(application.googlePlay, new AbortController().signal);
          const artifactType = planRequest.mode === 'uploadOnly'
            ? artifactPaths.android?.toLocaleLowerCase('en-US').endsWith('.aab') === true ? 'aab' : 'apk'
            : planRequest.androidArtifactType ?? application.android.defaultArtifactType;
          if (planRequest.mode === 'uploadOnly' && artifactPaths.android !== undefined) {
            await this.androidBuilder.verifySignature(application.android, artifactPaths.android, artifactType);
          }
        } else {
          if (application.appStoreConnect === null) {
            throw new Error('App Store Connect distribution configuration is incomplete.');
          }
          await resolveExistingFile(application.appStoreConnect.apiKeyPath, ['.p8']);
          await this.appStoreConnect.validateAccess(application.appStoreConnect, new AbortController().signal);
          if (planRequest.mode === 'uploadOnly') {
            throw new Error('App Store Connect distribution requires a new Xcode archive so its signing can be verified before upload.');
          }
        }
      }
      if (
        platform === 'android' &&
        planRequest.mode === 'uploadOnly' &&
        !hasDestination(planRequest.destinations, 'store') &&
        hasDestination(planRequest.destinations, 'firebase') &&
        application.firebaseDistribution.requiresAndroidSigning &&
        application.android !== null &&
        artifactPaths.android !== undefined
      ) {
        const artifactType = artifactPaths.android.toLocaleLowerCase('en-US').endsWith('.aab') ? 'aab' : 'apk';
        await this.androidBuilder.verifySignature(application.android, artifactPaths.android, artifactType);
      }
      if (
        platform === 'ios' &&
        planRequest.mode === 'uploadOnly' &&
        hasDestination(planRequest.destinations, 'firebase') &&
        application.firebaseDistribution.requiresIosSigning &&
        artifactPaths.ios !== undefined
      ) {
        await this.iosBuilder.verifyIpaSignature(artifactPaths.ios);
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
    if (new Set(request.destinations).size !== request.destinations.length) {
      issues.push({ code: 'invalidConfiguration', message: 'The same destination cannot be selected more than once.', severity: 'error' });
    }
    for (const destination of request.destinations) {
      const isConfigured = destination === 'artifact'
        ? application.artifactGeneration.isEnabled && request.platforms.every((platform) =>
            platform === 'android'
              ? application.artifactGeneration.androidArtifactTypes.includes(
                  request.androidArtifactType ?? application.android?.defaultArtifactType ?? 'apk',
                )
              : application.artifactGeneration.isIosIpaEnabled,
          )
        : destination === 'firebase'
          ? application.firebaseDistribution.isEnabled
          : request.platforms.every((platform) =>
              platform === 'android' ? application.googlePlay !== null : application.appStoreConnect !== null,
            );
      if (!isConfigured) {
        issues.push({ code: 'invalidConfiguration', message: `${destination === 'artifact' ? 'Artifact generation' : destination === 'firebase' ? 'Firebase App Distribution' : 'Store Distribution'} is not configured for the selected platforms.`, severity: 'error' });
      }
    }
    const invalidGroup = hasDestination(request.destinations, 'firebase')
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
    if (hasDestination(request.destinations, 'artifact')) {
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
    if (hasDestination(request.destinations, 'firebase')) {
      try {
        if (application.serviceAccountPath === null) throw new Error('Firebase credentials are unavailable.');
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
      (total, platform) => total + countPlatformSteps(application.hooks, request.mode, platform, request.destinations),
      0,
    );
    const resolvedAndroidArtifactType = request.platforms.includes('android')
      ? request.mode === 'uploadOnly' && artifactPaths.android !== undefined
        ? artifactPaths.android.toLowerCase().endsWith('.aab')
          ? 'aab'
          : 'apk'
        : request.androidArtifactType ?? application.android?.defaultArtifactType ?? 'apk'
      : undefined;
    const signingPlatforms = includesBuild(request.mode)
      ? request.platforms.filter((platform) => shouldSignBuild(request, application, platform))
      : [];
    const publicPlan: ResolvedReleasePlan = {
      androidArtifactType: resolvedAndroidArtifactType,
      applicationId: application.id,
      applicationName: application.name,
      artifactOutputDirectoryPath,
      distributionGroups: [...request.distributionGroups],
      destinations: [...request.destinations],
      expiresAt: new Date(Date.now() + PLAN_LIFETIME_MS).toISOString(),
      mode: request.mode,
      phaseCount,
      planId,
      platforms: [...request.platforms],
      releaseNotes: request.releaseNotes,
      signingPlatforms,
      version: resolveReleaseVersion(request),
    };
    this.plans.set(planId, {
      application,
      artifactPaths,
      publicPlan,
      request: {
        ...request,
        artifactSigningPlatforms: [...request.artifactSigningPlatforms],
        distributionGroups: [...request.distributionGroups],
        platforms: [...request.platforms],
        version:
          request.version === undefined
            ? undefined
            : {
                android:
                  request.version.android === undefined
                    ? undefined
                    : { ...request.version.android },
                ios:
                  request.version.ios === undefined
                    ? undefined
                    : { ...request.version.ios },
              },
      },
    });
    const warnings: ValidationIssue[] = includesBuild(request.mode)
      ? [
          {
            code: 'invalidConfiguration',
            field: 'version',
            message: `Starting this pipeline will permanently update the selected ${request.platforms
              .map((platform) => platform === 'android' ? 'Gradle' : 'Xcode')
              .join(' and ')} project version ${request.platforms.length === 1 ? 'file' : 'files'}.`,
            severity: 'warning',
          },
        ]
      : [];
    if (application.hooks.some(
      (hook) =>
        hook.isEnabled &&
        ((includesBuild(request.mode) &&
          (hook.phase === 'preBuild' || hook.phase === 'postBuild')) ||
          (includesUpload(request.mode) &&
            (hook.phase === 'preUpload' || hook.phase === 'postUpload'))),
    )) {
      warnings.push({
        code: 'invalidConfiguration',
        message: 'Enabled custom pipeline commands will run in the selected working directories.',
        severity: 'warning',
      });
    }
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
    const redact = createRedactor([
      plan.application.serviceAccountPath ?? '',
      plan.application.androidSigning?.keystorePath ?? '',
      plan.application.androidSigning?.storePassword ?? '',
      plan.application.androidSigning?.keyPassword ?? '',
      plan.application.googlePlay?.serviceAccountPath ?? '',
      plan.application.appStoreConnect?.apiKeyPath ?? '',
    ]);
    let sequence = 0;
    let completedPhases = 0;
    let completedProgressWeight = 0;
    const totalProgressWeight = plan.request.platforms.reduce(
      (total, platform) =>
        total +
        getPlatformProgressWeight(
          plan.application.hooks,
          plan.request.mode,
          platform,
          plan.request.destinations,
        ),
      0,
    );
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
      const stepProgressWeight = PHASE_PROGRESS_WEIGHTS[phase];
      let activityCount = 0;
      let stepFraction = 0;
      const emitProgress = (progressKind: ReleaseProgressKind): void => {
        const calculatedPercent = Math.min(
          99,
          Math.round(
            ((completedProgressWeight + stepFraction * stepProgressWeight) /
              totalProgressWeight) * 100,
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
      const reportActivity = (): void => {
        activityCount += 1;
        const nextFraction = Math.min(
          0.9,
          0.08 + (1 - Math.exp(-activityCount / 18)) * 0.82,
        );
        if (nextFraction <= stepFraction) return;
        stepFraction = nextFraction;
        emitProgress('estimated');
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
      completedProgressWeight += stepProgressWeight;
      stepFraction = 0;
      const verifiedPercent = Math.round(
        (completedProgressWeight / totalProgressWeight) * 100,
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
          firebaseStatus: hasDestination(plan.request.destinations, 'firebase') ? 'failed' : 'notRequested',
          platform,
          storeStatus: hasDestination(plan.request.destinations, 'store') ? 'failed' : 'notRequested',
          uploadStatus: includesUpload(plan.request.mode) ? 'failed' : 'notRequested',
        };
        platformResults.push(platformResult);
        try {
          if (includesBuild(plan.request.mode)) {
            await runStep('versioning', platform, 'Applying the confirmed release version.', async () => {
              if (platform === 'android' && plan.application.android !== null) {
                const version = plan.publicPlan.version?.android;
                if (version === undefined) {
                  throw new Error('The Android version is missing from the confirmed plan.');
                }
                await this.androidBuilder.applyVersion(plan.application.android, version);
              } else if (platform === 'ios' && plan.application.ios !== null) {
                const version = plan.publicPlan.version?.ios;
                if (version === undefined) {
                  throw new Error('The iOS version is missing from the confirmed plan.');
                }
                await this.iosBuilder.applyVersion(plan.application.ios, version);
              } else {
                throw new Error('Platform version configuration was not found.');
              }
            });
            await runHooks('preBuild', platform);
            await runStep('build', platform, `${platform === 'android' ? 'Android' : 'iOS'} build started.`, async (reportActivity) => {
              if (platform === 'android' && plan.application.android !== null) {
                const requiresSigning = shouldSignBuild(
                  plan.request,
                  plan.application,
                  platform,
                );
                artifactPath = await this.androidBuilder.build(
                  plan.application.android,
                  plan.publicPlan.androidArtifactType ?? plan.application.android.defaultArtifactType,
                  abortController.signal,
                  ({ level, line }) => {
                    reportActivity(line);
                    emitLog(line, level === 'error' ? 'error' : 'info', platform);
                  },
                  requiresSigning ? plan.application.androidSigning ?? undefined : undefined,
                );
              } else if (platform === 'ios' && plan.application.ios !== null) {
                const requiresSigning = shouldSignBuild(
                  plan.request,
                  plan.application,
                  platform,
                );
                artifactPath = await this.iosBuilder.build(
                  plan.application.ios,
                  path.join(runWorkspacePath, 'ios'),
                  abortController.signal,
                  ({ level, line }) => {
                    reportActivity(line);
                    emitLog(line, level === 'error' ? 'error' : 'info', platform);
                  },
                  {
                    appStoreConnect: plan.application.appStoreConnect ?? undefined,
                    signing: requiresSigning ? plan.application.iosSigning : undefined,
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
          if (hasDestination(plan.request.destinations, 'artifact')) {
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
          if (hasDestination(plan.request.destinations, 'firebase') || hasDestination(plan.request.destinations, 'store')) {
            failureArea = 'upload';
            await runHooks('preUpload', platform);
          }
          const uploadFailures: string[] = [];
          const attemptUpload = async (operation: () => Promise<void>): Promise<void> => {
            try {
              await operation();
            } catch (error) {
              if (abortController.signal.aborted) throw error;
              const message = safeErrorMessage(error);
              uploadFailures.push(message);
              emitLog(message, 'error', platform);
            }
          };
          if (hasDestination(plan.request.destinations, 'firebase')) {
            await attemptUpload(() => runStep('upload', platform, 'Firebase App Distribution upload started.', async (reportActivity) => {
              const platformConfiguration =
                platform === 'android' ? plan.application.android : plan.application.ios;
              if (
                platformConfiguration === null ||
                platformConfiguration.firebaseAppId === null ||
                plan.application.serviceAccountPath === null ||
                artifactPath === undefined
              ) {
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
              if (uploadError !== undefined) {
                throw uploadError;
              }
              platformResult.firebaseStatus = 'succeeded';
            }));
          }
          if (
            hasDestination(plan.request.destinations, 'store') &&
            platform === 'android'
          ) {
            await attemptUpload(() => runStep('storeUpload', platform, 'Google Play internal testing upload started.', async () => {
              if (artifactPath === undefined || plan.application.googlePlay === null) {
                throw new Error('Google Play upload configuration is incomplete.');
              }
              await this.googlePlay.upload({
                artifactPath,
                configuration: plan.application.googlePlay,
                releaseName: `${plan.application.name} ${plan.publicPlan.version?.android?.versionName ?? ''}`.trim(),
                releaseNotes: plan.request.releaseNotes,
                signal: abortController.signal,
              });
              platformResult.storeStatus = 'succeeded';
            }));
          }
          if (
            hasDestination(plan.request.destinations, 'store') &&
            platform === 'ios'
          ) {
            await attemptUpload(() => runStep('storeUpload', platform, 'App Store Connect upload started.', async (reportActivity) => {
              if (plan.application.ios === null || plan.application.appStoreConnect === null) {
                throw new Error('App Store Connect upload configuration is incomplete.');
              }
              await this.iosBuilder.uploadArchiveToAppStore(
                plan.application.ios,
                path.join(runWorkspacePath, 'ios'),
                plan.application.appStoreConnect,
                abortController.signal,
                ({ level, line }) => {
                  reportActivity(line);
                  emitLog(line, level === 'error' ? 'error' : 'info', platform);
                },
              );
              platformResult.storeStatus = 'succeeded';
            }));
          }
          if (hasDestination(plan.request.destinations, 'firebase') || hasDestination(plan.request.destinations, 'store')) {
            platformResult.uploadStatus =
              platformResult.firebaseStatus !== 'failed' && platformResult.storeStatus !== 'failed'
                ? 'succeeded'
                : 'failed';
            await runHooks('postUpload', platform);
          }
          if (uploadFailures.length > 0) {
            throw new Error(uploadFailures.join(' '));
          }
          if (
            includesBuild(plan.request.mode) &&
            !hasDestination(plan.request.destinations, 'artifact') &&
            artifactPath !== undefined
          ) {
            await rm(artifactPath, { force: true });
            artifactPath = undefined;
            platformResult.artifactPath = undefined;
            emitLog('Temporary build artifact removed after distribution.', 'info', platform);
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
      const hasAnySuccess = platformResults.some((result) =>
        result.buildStatus === 'succeeded' ||
        result.firebaseStatus === 'succeeded' ||
        result.storeStatus === 'succeeded',
      );
      const outcome: ReleaseResult['outcome'] = isCancelled
        ? 'cancelled'
        : succeededPlatforms === platformResults.length
          ? 'succeeded'
          : succeededPlatforms > 0 || hasAnySuccess
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
        const { applicationId: _applicationId, ...configuration } = plan.request;
        this.history.add(result, configuration);
        onEvent({ result, runId, type: 'releaseFinished' });
        if (plan.application.shouldNotifyWhenFinished) {
          try {
            this.notifyReleaseCompletion({
              applicationName: plan.application.name,
              outcome: result.outcome,
              platforms: result.platforms.map((platformResult) => platformResult.platform),
            });
          } catch {
            // Native notification availability must not change the completed release outcome.
          }
        }
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
