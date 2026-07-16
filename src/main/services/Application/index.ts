import path from 'node:path';
import { readFile } from 'node:fs/promises';
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
  ApplicationDetail,
  CreateApplicationRequest,
  IosConfiguration,
  PipelineHook,
  UpdateArtifactOutputDirectoryRequest,
  UpdateApplicationRequest,
} from '@shared/contracts/domain';

type FirebaseFileMetadata = { appId: string; projectId: string | null };

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
  return { appId, projectId: readStringProperty(projectInfo, 'project_id') };
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
  return { appId, projectId: readStringProperty(configuration, 'PROJECT_ID') };
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
): Promise<{ configuration: AndroidConfiguration | null; projectId: string | null }> => {
  if (configuration === null) {
    return { configuration: null, projectId: null };
  }
  const projectPath = await resolveExistingDirectory(configuration.projectPath);
  const googleServicesJsonPath = await resolveExistingFile(configuration.googleServicesJsonPath, [
    '.json',
  ]);
  const metadata = await inspectGoogleServicesJson(googleServicesJsonPath);
  return {
    configuration: {
      ...configuration,
      aabArtifactPath: resolveOutputPath(projectPath, configuration.aabArtifactPath, '.aab'),
      artifactPath: resolveOutputPath(projectPath, configuration.artifactPath, '.apk'),
      firebaseAppId: metadata.appId,
      googleServicesJsonPath,
      projectPath,
    },
    projectId: metadata.projectId,
  };
};

const resolveIos = async (
  configuration: CreateApplicationRequest['ios'],
  iosBuilder: IosBuilder,
): Promise<{ configuration: IosConfiguration | null; projectId: string | null }> => {
  if (configuration === null) {
    return { configuration: null, projectId: null };
  }
  if (process.platform !== 'darwin') {
    throw new Error('iOS configuration is available only on macOS.');
  }
  const projectPath = await resolveExistingDirectory(configuration.projectPath);
  const googleServiceInfoPlistPath = await resolveExistingFile(
    configuration.googleServiceInfoPlistPath,
    ['.plist'],
  );
  const workspaceOrProjectPath = await resolveExistingBundlePath(configuration.workspaceOrProjectPath, [
    '.xcworkspace',
    '.xcodeproj',
  ]);
  const { schemes } = await iosBuilder.listSchemes(workspaceOrProjectPath);
  if (!schemes.includes(configuration.scheme)) {
    throw new Error(`The selected scheme was not found in the Xcode project: ${configuration.scheme}`);
  }
  const metadata = await inspectGoogleServiceInfoPlist(googleServiceInfoPlistPath);
  return {
    configuration: {
      ...configuration,
      artifactPath: resolveOutputPath(projectPath, configuration.artifactPath, '.ipa'),
      firebaseAppId: metadata.appId,
      googleServiceInfoPlistPath,
      projectPath,
      workspaceOrProjectPath,
    },
    projectId: metadata.projectId,
  };
};

export class ApplicationService {
  public constructor(
    private readonly repository: ApplicationRepository,
    private readonly iosBuilder: IosBuilder,
  ) {}

  private async resolveInput(
    request: CreateApplicationRequest,
    retainedServiceAccountPath?: string,
  ): Promise<PersistApplicationInput> {
    const serviceAccount = await inspectServiceAccount(
      retainedServiceAccountPath ?? request.serviceAccountPath,
    );
    const [android, ios, hooks] = await Promise.all([
      resolveAndroid(request.android),
      resolveIos(request.ios, this.iosBuilder),
      resolveHooks(request.hooks),
    ]);
    const requestedProjectId = request.firebaseProjectId.trim();
    const firebaseProjectId = requestedProjectId || serviceAccount.projectId;
    const observedProjectIds = [serviceAccount.projectId, android.projectId, ios.projectId].filter(
      (projectId): projectId is string => projectId !== null,
    );
    if (observedProjectIds.some((projectId) => projectId !== firebaseProjectId)) {
      throw new Error('The service account and Google Services files do not belong to the same Firebase project.');
    }
    return {
      android: android.configuration,
      artifactOutputDirectoryPath:
        request.artifactOutputDirectoryPath === null
          ? null
          : await resolveWritableDirectory(request.artifactOutputDirectoryPath),
      distributionGroups: [...new Set(request.distributionGroups.map((group) => group.trim()))],
      firebaseProjectId,
      hooks,
      ios: ios.configuration,
      name: request.name.trim(),
      serviceAccountFileName: path.basename(serviceAccount.path),
      serviceAccountPath: serviceAccount.path,
    };
  }

  public async create(request: CreateApplicationRequest): Promise<ApplicationDetail> {
    return this.repository.create(await this.resolveInput(request));
  }

  public async update(request: UpdateApplicationRequest): Promise<ApplicationDetail> {
    const currentApplication = this.repository.getStored(request.id);
    if (currentApplication === null) {
      throw new Error('The application to update was not found.');
    }
    const createRequest: CreateApplicationRequest = {
      android: request.android,
      artifactOutputDirectoryPath: request.artifactOutputDirectoryPath,
      distributionGroups: request.distributionGroups,
      firebaseProjectId: request.firebaseProjectId,
      hooks: request.hooks,
      ios: request.ios,
      name: request.name,
      serviceAccountPath: request.serviceAccountPath ?? currentApplication.serviceAccountPath,
    };
    return this.repository.update(request.id, await this.resolveInput(createRequest));
  }

  public async updateArtifactOutputDirectory(
    request: UpdateArtifactOutputDirectoryRequest,
  ): Promise<ApplicationDetail> {
    const directoryPath = await resolveWritableDirectory(request.directoryPath);
    return this.repository.updateArtifactOutputDirectory(request.applicationId, directoryPath);
  }
}
