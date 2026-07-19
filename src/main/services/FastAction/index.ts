import type { ApplicationRepository } from '@main/repositories/Application';
import type { FastActionRepository } from '@main/repositories/FastAction';
import {
  resolveExistingFile,
  resolveWritableDirectory,
} from '@main/utils/FileSystem';
import type {
  CreateFastActionRequest,
  DeleteFastActionRequest,
  DeleteFastActionResult,
  FastAction,
  FastActionConfiguration,
  UpdateFastActionRequest,
} from '@shared/contracts/release';

export class FastActionService {
  public constructor(
    private readonly applications: ApplicationRepository,
    private readonly fastActions: FastActionRepository,
  ) {}

  private async resolveConfiguration(
    applicationId: string,
    configuration: FastActionConfiguration,
  ): Promise<FastActionConfiguration> {
    const application = this.applications.get(applicationId);
    if (application === null) {
      throw new Error('The application for this fast action was not found.');
    }
    for (const platform of configuration.platforms) {
      if (!application.platforms.includes(platform)) {
        throw new Error(`${platform === 'android' ? 'Android' : 'iOS'} is not configured for this application.`);
      }
    }
    for (const destination of configuration.destinations) {
      const isConfigured = destination === 'artifact'
        ? application.artifactGeneration.isEnabled
        : destination === 'firebase'
          ? application.firebaseDistribution.isEnabled
          : configuration.platforms.every((platform) =>
              platform === 'android'
                ? application.googlePlay !== null
                : application.appStoreConnect !== null,
            );
      if (!isConfigured) {
        throw new Error('A selected fast action destination is not configured for this application.');
      }
    }
    if (
      configuration.mode === 'buildOnly' &&
      configuration.destinations.some((destination) => destination !== 'artifact')
    ) {
      throw new Error('A build-only fast action can use only the local artifact destination.');
    }
    if (
      configuration.mode === 'buildAndUpload' &&
      configuration.destinations.every((destination) => destination === 'artifact')
    ) {
      throw new Error('A build-and-upload fast action requires an upload destination.');
    }
    if (
      configuration.mode === 'uploadOnly' &&
      configuration.platforms.includes('ios') &&
      configuration.destinations.includes('store')
    ) {
      throw new Error('App Store Connect requires a newly built Xcode archive.');
    }

    const androidArtifactType = configuration.platforms.includes('android')
      ? configuration.androidArtifactType ?? application.android?.defaultArtifactType ?? 'apk'
      : undefined;
    if (
      configuration.destinations.includes('artifact') &&
      androidArtifactType !== undefined &&
      !application.artifactGeneration.androidArtifactTypes.includes(androidArtifactType)
    ) {
      throw new Error('The selected Android artifact type is not enabled for local generation.');
    }
    if (
      configuration.destinations.includes('store') &&
      application.googlePlay !== null &&
      configuration.platforms.includes('android') &&
      androidArtifactType !== application.googlePlay.artifactType
    ) {
      throw new Error(
        `Google Play is configured for ${application.googlePlay.artifactType.toUpperCase()} artifacts.`,
      );
    }

    let androidArtifactPath = configuration.androidArtifactPath;
    let iosArtifactPath = configuration.iosArtifactPath;
    if (configuration.mode === 'uploadOnly') {
      if (configuration.platforms.includes('android')) {
        if (androidArtifactPath === undefined) {
          throw new Error('Select an Android APK or AAB for this fast action.');
        }
        androidArtifactPath = await resolveExistingFile(androidArtifactPath, ['.apk', '.aab']);
      }
      if (configuration.platforms.includes('ios')) {
        if (iosArtifactPath === undefined) {
          throw new Error('Select an iOS IPA for this fast action.');
        }
        iosArtifactPath = await resolveExistingFile(iosArtifactPath, ['.ipa']);
      }
    }
    const artifactOutputDirectoryPath = configuration.destinations.includes('artifact')
      ? await resolveWritableDirectory(configuration.artifactOutputDirectoryPath ?? '')
      : undefined;

    return {
      androidArtifactPath,
      androidArtifactType,
      artifactOutputDirectoryPath,
      artifactSigningPlatforms: [...configuration.artifactSigningPlatforms],
      distributionGroups: [...configuration.distributionGroups],
      destinations: [...configuration.destinations],
      iosArtifactPath,
      mode: configuration.mode,
      platforms: [...configuration.platforms],
      releaseNotes: configuration.releaseNotes,
      version: configuration.version === undefined ? undefined : { ...configuration.version },
    };
  }

  public list(applicationId: string): FastAction[] {
    if (this.applications.get(applicationId) === null) {
      throw new Error('The application for these fast actions was not found.');
    }
    return this.fastActions.list(applicationId);
  }

  public async create(request: CreateFastActionRequest): Promise<FastAction> {
    return this.fastActions.create({
      ...request,
      configuration: await this.resolveConfiguration(request.applicationId, request.configuration),
      name: request.name.trim(),
    });
  }

  public async update(request: UpdateFastActionRequest): Promise<FastAction> {
    return this.fastActions.update({
      ...request,
      configuration: await this.resolveConfiguration(request.applicationId, request.configuration),
      name: request.name.trim(),
    });
  }

  public delete(request: DeleteFastActionRequest): DeleteFastActionResult {
    return { deleted: this.fastActions.delete(request) };
  }
}
