import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import type { AndroidBuilder } from '@main/services/AndroidBuilder';
import type { IosBuilder } from '@main/services/IosBuilder';
import type { FirebaseCliIntegration } from '@main/integrations/FirebaseCli';
import type { ApplicationRepository } from '@main/repositories/Application';
import type { RunHistoryRepository } from '@main/repositories/RunHistory';
import { runExecutable } from '@main/utils/ChildProcess';
import { resolveExistingDirectory, resolveExistingFile } from '@main/utils/FileSystem';
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
  return buildSteps + uploadSteps + 1;
};

const safeErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Beklenmeyen bir işlem hatası oluştu.';

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
        message: 'iOS release yalnız macOS üzerinde çalıştırılabilir.',
        severity: 'error',
      });
      return;
    }
    const configuration = platform === 'android' ? application.android : application.ios;
    if (configuration === null) {
      issues.push({
        code: 'invalidConfiguration',
        message: `${platform === 'android' ? 'Android' : 'iOS'} kurulumu bu uygulama için tamamlanmamış.`,
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
          [platform === 'android' ? '.apk' : '.ipa'],
        );
      } else {
        artifactPaths[platform] = configuration.artifactPath;
      }
      const relevantHooks = application.hooks.filter(
        (hook) => hook.isEnabled && (hook.platform === 'all' || hook.platform === platform),
      );
      await Promise.all(
        relevantHooks.map(async (hook) => {
          await resolveExistingFile(hook.executablePath);
          await resolveExistingDirectory(hook.cwdPath);
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
        issues: [{ code: 'applicationNotFound', message: 'Uygulama bulunamadı.', severity: 'error' }],
      };
    }
    if (new Set(request.platforms).size !== request.platforms.length) {
      issues.push({
        code: 'invalidConfiguration',
        message: 'Aynı platform birden fazla seçilemez.',
        severity: 'error',
      });
    }
    const invalidGroup = request.distributionGroups.find(
      (group) => !GROUP_ALIAS_PATTERN.test(group),
    );
    if (invalidGroup !== undefined) {
      issues.push({
        code: 'invalidConfiguration',
        field: 'distributionGroups',
        message: `Geçersiz tester grup aliası: ${invalidGroup}`,
        severity: 'error',
      });
    }
    const artifactPaths: InternalReleasePlan['artifactPaths'] = {};
    await Promise.all(
      request.platforms.map((platform) =>
        this.validatePlatform(request, application, platform, issues, artifactPaths),
      ),
    );
    try {
      await resolveExistingFile(application.serviceAccountPath, ['.json']);
      if (includesUpload(request.mode)) {
        if ((await this.firebaseCli.getExecutablePath()) === null) {
          issues.push({
            code: 'firebaseCliMissing',
            message: 'Firebase CLI bulunamadı.',
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
      }
    } catch (error) {
      issues.push({
        code: includesUpload(request.mode) ? 'firebaseAccessDenied' : 'credentialUnavailable',
        message: includesUpload(request.mode)
          ? 'Firebase projesine Service Account ile erişilemedi.'
          : safeErrorMessage(error),
        severity: 'error',
      });
    }
    if (issues.some((issue) => issue.severity === 'error')) {
      return { isValid: false, issues };
    }
    const planId = randomUUID();
    const phaseCount = request.platforms.reduce(
      (total, platform) => total + countPlatformSteps(application.hooks, request.mode, platform),
      0,
    );
    const publicPlan: ResolvedReleasePlan = {
      applicationId: application.id,
      applicationName: application.name,
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
    const warnings: ValidationIssue[] = application.hooks.some((hook) => hook.isEnabled)
      ? [
          {
            code: 'invalidConfiguration',
            message: 'Etkin özel pipeline komutları seçilen çalışma klasörlerinde çalıştırılacak.',
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
          message: 'Başka bir release işlemi devam ediyor.',
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
          message: 'Preflight planının süresi doldu. Yeniden doğrulayın.',
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
      operation: () => Promise<void>,
    ): Promise<void> => {
      activePhase = phase;
      onEvent({
        activePhase,
        completedPhases,
        percent: Math.round((completedPhases / plan.publicPlan.phaseCount) * 100),
        platform,
        runId,
        totalPhases: plan.publicPlan.phaseCount,
        type: 'phaseChanged',
      });
      emitLog(label, 'info', platform);
      await operation();
      completedPhases += 1;
      onEvent({
        activePhase,
        completedPhases,
        percent: Math.round((completedPhases / plan.publicPlan.phaseCount) * 100),
        platform,
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
        await runStep(phase, platform, `Özel adım: ${hook.name}`, async () => {
          const result = await runExecutable({
            args: hook.args,
            cwdPath: hook.cwdPath,
            executablePath: hook.executablePath,
            onOutput: ({ level, line }) => emitLog(line, level === 'error' ? 'error' : 'info', platform),
            signal: abortController.signal,
          });
          if (result.exitCode !== 0) {
            throw new Error(`${hook.name} ${result.exitCode} çıkış koduyla başarısız oldu.`);
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
            await runStep('build', platform, `${platform === 'android' ? 'Android' : 'iOS'} build başladı.`, async () => {
              if (platform === 'android' && plan.application.android !== null) {
                artifactPath = await this.androidBuilder.build(
                  plan.application.android,
                  abortController.signal,
                  ({ level, line }) => emitLog(line, level === 'error' ? 'error' : 'info', platform),
                );
              } else if (platform === 'ios' && plan.application.ios !== null) {
                artifactPath = await this.iosBuilder.build(
                  plan.application.ios,
                  path.join(runWorkspacePath, 'ios'),
                  abortController.signal,
                  ({ level, line }) => emitLog(line, level === 'error' ? 'error' : 'info', platform),
                );
              } else {
                throw new Error('Platform build yapılandırması bulunamadı.');
              }
              platformResult.buildStatus = 'succeeded';
            });
            await runHooks('postBuild', platform);
          }
          await runStep('verifying', platform, 'Artifact doğrulanıyor.', async () => {
            if (artifactPath === undefined) {
              throw new Error('Artifact yolu çözülemedi.');
            }
            artifactPath = await resolveExistingFile(artifactPath, [platform === 'android' ? '.apk' : '.ipa']);
            platformResult.artifactPath = artifactPath;
          });
          if (includesUpload(plan.request.mode)) {
            failureArea = 'upload';
            await runHooks('preUpload', platform);
            await runStep('upload', platform, 'Firebase App Distribution upload başladı.', async () => {
              const platformConfiguration =
                platform === 'android' ? plan.application.android : plan.application.ios;
              if (platformConfiguration === null || artifactPath === undefined) {
                throw new Error('Upload yapılandırması eksik.');
              }
              await this.firebaseCli.upload({
                appId: platformConfiguration.firebaseAppId,
                artifactPath,
                credentialPath: plan.application.serviceAccountPath,
                cwdPath: platformConfiguration.projectPath,
                groups: plan.request.distributionGroups,
                onOutput: ({ level, line }) =>
                  emitLog(line, level === 'error' ? 'error' : 'info', platform),
                projectId: plan.application.firebaseProjectId,
                releaseNotes: plan.request.releaseNotes,
                signal: abortController.signal,
              });
              platformResult.uploadStatus = 'succeeded';
            });
            await runHooks('postUpload', platform);
          }
          emitLog('Platform pipeline tamamlandı.', 'info', platform);
        } catch (error) {
          if (abortController.signal.aborted) {
            throw error;
          }
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
