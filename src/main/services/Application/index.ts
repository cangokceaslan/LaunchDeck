import path from 'node:path';
import { lstat, readFile } from 'node:fs/promises';
import { parse as parsePlist } from 'plist';
import type { ApplicationRepository } from '@main/repositories/Application';
import type { PersistApplicationInput } from '@main/repositories/Application/index.types';
import type { IosBuilder } from '@main/services/IosBuilder';
import { resolveCommandLine } from '@main/utils/CommandLine';
import {
  isRecord,
  readJsonConfiguration,
  readStringProperty,
  resolveExistingBundlePath,
  resolveExistingDirectory,
  resolveExistingFile,
  resolveWritableDirectory,
} from '@main/utils/FileSystem';
import type {
  AndroidConfiguration,
  AndroidProjectMetadataRequest,
  AndroidProjectMetadataResult,
  AndroidSigningSetupConfiguration,
  AppStoreConnectSetupConfiguration,
  ApplicationDetail,
  CreateApplicationRequest,
  GooglePlaySetupConfiguration,
  IosConfiguration,
  PipelineHook,
  UpdateArtifactOutputDirectoryRequest,
  UpdateApplicationRequest,
} from '@shared/contracts/domain';

type FirebaseFileMetadata = {
  appId: string;
  packageName: string | null;
  projectId: string | null;
};

const MAX_ANDROID_BUILD_FILE_BYTES = 2 * 1024 * 1024;
const ANDROID_PACKAGE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/u;
const ANDROID_APPLICATION_ID_PATTERN = /\bapplicationId\s*(?:=\s*)?["']([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+)["']/gu;

const resolveOutputPath = (projectPath: string, outputPath: string, extension: string): string => {
  const resolvedOutputPath = path.resolve(projectPath, outputPath);
  const relativePath = path.relative(projectPath, resolvedOutputPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('The build output must be inside the selected project directory.');
  }
  if (!resolvedOutputPath.toLowerCase().endsWith(extension)) {
    throw new Error(`The build output must have the ${extension} extension.`);
  }
  return resolvedOutputPath;
};

const inspectServiceAccount = async (
  serviceAccountPath: string,
): Promise<{ path: string; projectId: string }> => {
  const resolvedPath = await resolveExistingFile(serviceAccountPath, ['.json']);
  const serviceAccount = await readJsonConfiguration(resolvedPath);
  if (!isRecord(serviceAccount) || readStringProperty(serviceAccount, 'type') !== 'service_account') {
    throw new Error('The selected JSON is not a valid Firebase service account file.');
  }
  const projectId = readStringProperty(serviceAccount, 'project_id');
  if (projectId === null) {
    throw new Error('project_id was not found in the service account file.');
  }
  return { path: resolvedPath, projectId };
};

const inspectGoogleServicesJson = async (filePath: string): Promise<FirebaseFileMetadata> => {
  const resolvedPath = await resolveExistingFile(filePath, ['.json']);
  const configuration = await readJsonConfiguration(resolvedPath);
  if (!isRecord(configuration)) {
    throw new Error('The google-services.json structure is invalid.');
  }
  const projectInfo = configuration.project_info;
  const clients = configuration.client;
  if (!isRecord(projectInfo) || !Array.isArray(clients) || clients.length === 0) {
    throw new Error('No Firebase client was found in google-services.json.');
  }
  const firstClient = clients[0];
  if (!isRecord(firstClient)) {
    throw new Error('The google-services.json client structure is invalid.');
  }
  const clientInfo = firstClient.client_info;
  if (!isRecord(clientInfo)) {
    throw new Error('The client_info field in google-services.json is invalid.');
  }
  const appId = readStringProperty(clientInfo, 'mobilesdk_app_id');
  if (appId === null) {
    throw new Error('mobilesdk_app_id was not found in google-services.json.');
  }
  const packageNames = clients.flatMap((client) => {
    if (!isRecord(client) || !isRecord(client.client_info)) return [];
    const androidClientInfo = client.client_info.android_client_info;
    if (!isRecord(androidClientInfo)) return [];
    const packageName = readStringProperty(androidClientInfo, 'package_name');
    return packageName !== null && ANDROID_PACKAGE_NAME_PATTERN.test(packageName)
      ? [packageName]
      : [];
  });
  const uniquePackageNames = [...new Set(packageNames)];
  return {
    appId,
    packageName: uniquePackageNames.length === 1 ? uniquePackageNames[0] ?? null : null,
    projectId: readStringProperty(projectInfo, 'project_id'),
  };
};

const inspectGoogleServiceInfoPlist = async (filePath: string): Promise<FirebaseFileMetadata> => {
  const resolvedPath = await resolveExistingFile(filePath, ['.plist']);
  const contents = await readFile(resolvedPath, 'utf8');
  const configuration: unknown = parsePlist(contents);
  if (!isRecord(configuration)) {
    throw new Error('The GoogleService-Info.plist structure is invalid.');
  }
  const appId = readStringProperty(configuration, 'GOOGLE_APP_ID');
  if (appId === null) {
    throw new Error('GOOGLE_APP_ID was not found in GoogleService-Info.plist.');
  }
  return {
    appId,
    packageName: null,
    projectId: readStringProperty(configuration, 'PROJECT_ID'),
  };
};

const readGradlePackageName = async (
  projectPath: string,
  gradleTask: string,
): Promise<string | null> => {
  const taskSegments = gradleTask.split(':').filter(Boolean);
  const moduleSegments = taskSegments.slice(0, -1);
  const candidateDirectories = [
    moduleSegments.length === 0 ? path.join(projectPath, 'app') : path.join(projectPath, ...moduleSegments),
    path.join(projectPath, 'app'),
    projectPath,
  ];
  const packageNames: string[] = [];
  for (const candidateDirectory of [...new Set(candidateDirectories)]) {
    for (const fileName of ['build.gradle', 'build.gradle.kts']) {
      const candidatePath = path.join(candidateDirectory, fileName);
      try {
        const resolvedPath = await resolveExistingFile(candidatePath, ['.gradle', '.gradle.kts']);
        const stats = await lstat(resolvedPath);
        if (stats.size > MAX_ANDROID_BUILD_FILE_BYTES) {
          throw new Error('The Android Gradle configuration exceeds the supported size.');
        }
        const contents = await readFile(resolvedPath, 'utf8');
        packageNames.push(
          ...[...contents.matchAll(ANDROID_APPLICATION_ID_PATTERN)].flatMap((match) =>
            match[1] === undefined ? [] : [match[1]],
          ),
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes('exceeds the supported size')) {
          throw error;
        }
      }
    }
  }
  const uniquePackageNames = [...new Set(packageNames)];
  return uniquePackageNames.length === 1 ? uniquePackageNames[0] ?? null : null;
};

const inspectAndroidProjectMetadata = async (
  request: AndroidProjectMetadataRequest,
): Promise<AndroidProjectMetadataResult> => {
  const projectPath = await resolveExistingDirectory(request.projectPath);
  if (request.googleServicesJsonPath !== null && request.googleServicesJsonPath.trim() !== '') {
    const firebaseMetadata = await inspectGoogleServicesJson(request.googleServicesJsonPath);
    if (firebaseMetadata.packageName !== null) {
      return { packageName: firebaseMetadata.packageName };
    }
  }
  return { packageName: await readGradlePackageName(projectPath, request.gradleTask) };
};

const resolveHooks = async (hooks: PipelineHook[]): Promise<PipelineHook[]> =>
  Promise.all(
    hooks.map(async (hook) => {
      const cwdPath = await resolveExistingDirectory(hook.cwdPath);
      await resolveCommandLine(hook.command, cwdPath);
      return {
        ...hook,
        command: hook.command.trim(),
        cwdPath,
      };
    }),
  );

const resolveAndroid = async (
  configuration: CreateApplicationRequest['android'],
  isFirebaseEnabled: boolean,
): Promise<{
  configuration: AndroidConfiguration | null;
  packageName: string | null;
  projectId: string | null;
}> => {
  if (configuration === null) {
    return { configuration: null, packageName: null, projectId: null };
  }
  const projectPath = await resolveExistingDirectory(configuration.projectPath);
  const googleServicesJsonPath = isFirebaseEnabled
    ? await resolveExistingFile(configuration.googleServicesJsonPath ?? '', ['.json'])
    : null;
  const metadata = googleServicesJsonPath === null
    ? null
    : await inspectGoogleServicesJson(googleServicesJsonPath);
  const packageName = metadata?.packageName ?? await readGradlePackageName(
    projectPath,
    configuration.gradleTask,
  );
  return {
    configuration: {
      ...configuration,
      aabArtifactPath: resolveOutputPath(projectPath, configuration.aabArtifactPath, '.aab'),
      artifactPath: resolveOutputPath(projectPath, configuration.artifactPath, '.apk'),
      firebaseAppId: metadata?.appId ?? null,
      googleServicesJsonPath,
      projectPath,
    },
    packageName,
    projectId: metadata?.projectId ?? null,
  };
};

const resolveIos = async (
  configuration: CreateApplicationRequest['ios'],
  iosBuilder: IosBuilder,
  isFirebaseEnabled: boolean,
  shouldResolveProjectMetadata: boolean,
): Promise<{
  configuration: IosConfiguration | null;
  developmentTeamId: string | null;
  projectId: string | null;
}> => {
  if (configuration === null) {
    return { configuration: null, developmentTeamId: null, projectId: null };
  }
  if (process.platform !== 'darwin') {
    throw new Error('iOS configuration is available only on macOS.');
  }
  const projectPath = await resolveExistingDirectory(configuration.projectPath);
  const googleServiceInfoPlistPath = isFirebaseEnabled
    ? await resolveExistingFile(configuration.googleServiceInfoPlistPath ?? '', ['.plist'])
    : null;
  const workspaceOrProjectPath = await resolveExistingBundlePath(configuration.workspaceOrProjectPath, [
    '.xcworkspace',
    '.xcodeproj',
  ]);
  const { schemes } = await iosBuilder.listSchemes(workspaceOrProjectPath);
  if (!schemes.includes(configuration.scheme)) {
    throw new Error(`The selected scheme was not found in the Xcode project: ${configuration.scheme}`);
  }
  const projectMetadata = shouldResolveProjectMetadata
    ? await iosBuilder.resolveProjectMetadata({
        configuration: configuration.configuration,
        scheme: configuration.scheme,
        workspaceOrProjectPath,
      })
    : null;
  const metadata = googleServiceInfoPlistPath === null
    ? null
    : await inspectGoogleServiceInfoPlist(googleServiceInfoPlistPath);
  return {
    configuration: {
      ...configuration,
      artifactPath: resolveOutputPath(projectPath, configuration.artifactPath, '.ipa'),
      bundleIdentifier: projectMetadata?.bundleIdentifier ?? configuration.bundleIdentifier,
      firebaseAppId: metadata?.appId ?? null,
      googleServiceInfoPlistPath,
      projectPath,
      workspaceOrProjectPath,
    },
    developmentTeamId: projectMetadata?.developmentTeamId ?? null,
    projectId: metadata?.projectId ?? null,
  };
};

const resolveAndroidSigning = async (
  configuration: AndroidSigningSetupConfiguration | null,
  retainedConfiguration?: AndroidSigningSetupConfiguration | null,
): Promise<AndroidSigningSetupConfiguration | null> => {
  if (configuration === null) return null;
  const keystorePath = configuration.keystorePath.trim() === ''
    ? retainedConfiguration?.keystorePath ?? ''
    : configuration.keystorePath;
  const storePassword = configuration.storePassword === ''
    ? retainedConfiguration?.storePassword ?? ''
    : configuration.storePassword;
  const keyPassword = configuration.keyPassword === ''
    ? retainedConfiguration?.keyPassword ?? ''
    : configuration.keyPassword;
  if (keystorePath === '' || storePassword === '' || keyPassword === '') {
    throw new Error('Android signing credentials are incomplete.');
  }
  return {
    keyAlias: configuration.keyAlias.trim(),
    keyPassword,
    keystorePath: await resolveExistingFile(keystorePath, ['.jks', '.keystore']),
    storePassword,
  };
};

const resolveGooglePlay = async (
  configuration: GooglePlaySetupConfiguration | null,
  retainedConfiguration?: GooglePlaySetupConfiguration | null,
): Promise<GooglePlaySetupConfiguration | null> => {
  if (configuration === null) return null;
  const requestedPath = configuration.serviceAccountPath.trim() === ''
    ? retainedConfiguration?.serviceAccountPath ?? ''
    : configuration.serviceAccountPath;
  if (requestedPath === '') {
    throw new Error('Google Play service account credentials are required.');
  }
  const serviceAccount = await inspectServiceAccount(requestedPath);
  return {
    ...configuration,
    initialTrack: configuration.initialTrack.trim(),
    packageName: configuration.packageName.trim(),
    promotionTrack: configuration.promotionTrack.trim(),
    releaseNotesLanguage: configuration.releaseNotesLanguage.trim(),
    serviceAccountPath: serviceAccount.path,
  };
};

const resolveAppStoreConnect = async (
  configuration: AppStoreConnectSetupConfiguration | null,
  retainedConfiguration?: AppStoreConnectSetupConfiguration | null,
): Promise<AppStoreConnectSetupConfiguration | null> => {
  if (configuration === null) return null;
  const requestedPath = configuration.apiKeyPath.trim() === ''
    ? retainedConfiguration?.apiKeyPath ?? ''
    : configuration.apiKeyPath;
  if (requestedPath === '') {
    throw new Error('An App Store Connect API private key is required.');
  }
  return {
    ...configuration,
    apiKeyId: configuration.apiKeyId.trim(),
    apiKeyPath: await resolveExistingFile(requestedPath, ['.p8']),
    issuerId: configuration.issuerId.trim(),
  };
};

export class ApplicationService {
  public constructor(
    private readonly repository: ApplicationRepository,
    private readonly iosBuilder: IosBuilder,
  ) {}

  public async resolveAndroidProjectMetadata(
    request: AndroidProjectMetadataRequest,
  ): Promise<AndroidProjectMetadataResult> {
    return inspectAndroidProjectMetadata(request);
  }

  private async resolveInput(
    request: CreateApplicationRequest,
    retainedApplication?: ReturnType<ApplicationRepository['getStored']>,
  ): Promise<PersistApplicationInput> {
    const requestedServiceAccountPath = request.serviceAccountPath.trim() === ''
      ? retainedApplication?.serviceAccountPath ?? ''
      : request.serviceAccountPath;
    const serviceAccount = request.firebaseDistribution.isEnabled
      ? await inspectServiceAccount(requestedServiceAccountPath)
      : null;
    const shouldResolveIosProjectMetadata = request.ios !== null && (
      request.appStoreConnect !== null ||
      (request.artifactGeneration.isEnabled && request.artifactGeneration.requiresIosSigning) ||
      (request.firebaseDistribution.isEnabled && request.firebaseDistribution.requiresIosSigning)
    );
    const [android, ios, hooks, androidSigning, googlePlay, appStoreConnect] = await Promise.all([
      resolveAndroid(request.android, request.firebaseDistribution.isEnabled),
      resolveIos(
        request.ios,
        this.iosBuilder,
        request.firebaseDistribution.isEnabled,
        shouldResolveIosProjectMetadata,
      ),
      resolveHooks(request.hooks),
      resolveAndroidSigning(request.androidSigning, retainedApplication?.androidSigning),
      resolveGooglePlay(request.googlePlay, retainedApplication?.googlePlay),
      resolveAppStoreConnect(request.appStoreConnect, retainedApplication?.appStoreConnect),
    ]);
    const requestedProjectId = request.firebaseProjectId.trim();
    const firebaseProjectId = request.firebaseDistribution.isEnabled
      ? requestedProjectId || serviceAccount?.projectId || ''
      : '';
    const observedProjectIds = [serviceAccount?.projectId ?? null, android.projectId, ios.projectId].filter(
      (projectId): projectId is string => projectId !== null,
    );
    if (observedProjectIds.some((projectId) => projectId !== firebaseProjectId)) {
      throw new Error('The service account and Google Services files do not belong to the same Firebase project.');
    }
    return {
      android: android.configuration,
      androidSigning,
      appStoreConnect,
      artifactGeneration: request.artifactGeneration,
      artifactOutputDirectoryPath:
        request.artifactOutputDirectoryPath === null
          ? null
          : await resolveWritableDirectory(request.artifactOutputDirectoryPath),
      distributionGroups: [...new Set(request.distributionGroups.map((group) => group.trim()))],
      firebaseDistribution: request.firebaseDistribution,
      firebaseProjectId,
      googlePlay: googlePlay === null
        ? null
        : { ...googlePlay, packageName: android.packageName ?? googlePlay.packageName },
      hooks,
      ios: ios.configuration,
      iosSigning: ios.developmentTeamId === null
        ? request.iosSigning
        : { ...request.iosSigning, developmentTeamId: ios.developmentTeamId },
      name: request.name.trim(),
      serviceAccountFileName: serviceAccount === null ? '' : path.basename(serviceAccount.path),
      serviceAccountPath: serviceAccount?.path ?? null,
    };
  }

  public async create(request: CreateApplicationRequest): Promise<ApplicationDetail> {
    return this.repository.create(await this.resolveInput(request, null));
  }

  public async update(request: UpdateApplicationRequest): Promise<ApplicationDetail> {
    const currentApplication = this.repository.getStored(request.id);
    if (currentApplication === null) {
      throw new Error('The application to update was not found.');
    }
    const createRequest: CreateApplicationRequest = {
      android: request.android,
      androidSigning: request.androidSigning,
      appStoreConnect: request.appStoreConnect,
      artifactGeneration: request.artifactGeneration,
      artifactOutputDirectoryPath: request.artifactOutputDirectoryPath,
      distributionGroups: request.distributionGroups,
      firebaseDistribution: request.firebaseDistribution,
      firebaseProjectId: request.firebaseProjectId,
      googlePlay: request.googlePlay,
      hooks: request.hooks,
      ios: request.ios,
      iosSigning: request.iosSigning,
      name: request.name,
      serviceAccountPath: request.serviceAccountPath ?? '',
    };
    return this.repository.update(request.id, await this.resolveInput(createRequest, currentApplication));
  }

  public async updateArtifactOutputDirectory(
    request: UpdateArtifactOutputDirectoryRequest,
  ): Promise<ApplicationDetail> {
    const directoryPath = await resolveWritableDirectory(request.directoryPath);
    return this.repository.updateArtifactOutputDirectory(request.applicationId, directoryPath);
  }
}
