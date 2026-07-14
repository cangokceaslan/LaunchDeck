import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { parse as parsePlist } from 'plist';
import type { ApplicationRepository } from '@main/repositories/Application';
import type { PersistApplicationInput } from '@main/repositories/Application/index.types';
import {
  isRecord,
  readJsonConfiguration,
  readStringProperty,
  resolveExistingBundlePath,
  resolveExistingDirectory,
  resolveExistingFile,
} from '@main/utils/FileSystem';
import type {
  AndroidConfiguration,
  ApplicationDetail,
  CreateApplicationRequest,
  IosConfiguration,
  PipelineHook,
  UpdateApplicationRequest,
} from '@shared/contracts/domain';

type FirebaseFileMetadata = { appId: string; projectId: string | null };

const resolveOutputPath = (projectPath: string, outputPath: string, extension: string): string => {
  const resolvedOutputPath = path.resolve(projectPath, outputPath);
  const relativePath = path.relative(projectPath, resolvedOutputPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Build çıktısı seçilen proje klasörünün içinde olmalıdır.');
  }
  if (!resolvedOutputPath.toLowerCase().endsWith(extension)) {
    throw new Error(`Build çıktısı ${extension} uzantılı olmalıdır.`);
  }
  return resolvedOutputPath;
};

const inspectServiceAccount = async (
  serviceAccountPath: string,
): Promise<{ path: string; projectId: string }> => {
  const resolvedPath = await resolveExistingFile(serviceAccountPath, ['.json']);
  const serviceAccount = await readJsonConfiguration(resolvedPath);
  if (!isRecord(serviceAccount) || readStringProperty(serviceAccount, 'type') !== 'service_account') {
    throw new Error('Seçilen JSON geçerli bir Firebase Service Account dosyası değil.');
  }
  const projectId = readStringProperty(serviceAccount, 'project_id');
  if (projectId === null) {
    throw new Error('Service Account dosyasında project_id bulunamadı.');
  }
  return { path: resolvedPath, projectId };
};

const inspectGoogleServicesJson = async (filePath: string): Promise<FirebaseFileMetadata> => {
  const resolvedPath = await resolveExistingFile(filePath, ['.json']);
  const configuration = await readJsonConfiguration(resolvedPath);
  if (!isRecord(configuration)) {
    throw new Error('google-services.json yapısı geçersiz.');
  }
  const projectInfo = configuration.project_info;
  const clients = configuration.client;
  if (!isRecord(projectInfo) || !Array.isArray(clients) || clients.length === 0) {
    throw new Error('google-services.json içinde Firebase istemcisi bulunamadı.');
  }
  const firstClient = clients[0];
  if (!isRecord(firstClient)) {
    throw new Error('google-services.json istemci yapısı geçersiz.');
  }
  const clientInfo = firstClient.client_info;
  if (!isRecord(clientInfo)) {
    throw new Error('google-services.json client_info alanı geçersiz.');
  }
  const appId = readStringProperty(clientInfo, 'mobilesdk_app_id');
  if (appId === null) {
    throw new Error('google-services.json içinde mobilesdk_app_id bulunamadı.');
  }
  return { appId, projectId: readStringProperty(projectInfo, 'project_id') };
};

const inspectGoogleServiceInfoPlist = async (filePath: string): Promise<FirebaseFileMetadata> => {
  const resolvedPath = await resolveExistingFile(filePath, ['.plist']);
  const contents = await readFile(resolvedPath, 'utf8');
  const configuration: unknown = parsePlist(contents);
  if (!isRecord(configuration)) {
    throw new Error('GoogleService-Info.plist yapısı geçersiz.');
  }
  const appId = readStringProperty(configuration, 'GOOGLE_APP_ID');
  if (appId === null) {
    throw new Error('GoogleService-Info.plist içinde GOOGLE_APP_ID bulunamadı.');
  }
  return { appId, projectId: readStringProperty(configuration, 'PROJECT_ID') };
};

const resolveHooks = async (hooks: PipelineHook[]): Promise<PipelineHook[]> =>
  Promise.all(
    hooks.map(async (hook) => ({
      ...hook,
      cwdPath: await resolveExistingDirectory(hook.cwdPath),
      executablePath: await resolveExistingFile(hook.executablePath),
    })),
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
): Promise<{ configuration: IosConfiguration | null; projectId: string | null }> => {
  if (configuration === null) {
    return { configuration: null, projectId: null };
  }
  if (process.platform !== 'darwin') {
    throw new Error('iOS yapılandırması yalnız macOS üzerinde kullanılabilir.');
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
  public constructor(private readonly repository: ApplicationRepository) {}

  private async resolveInput(
    request: CreateApplicationRequest,
    retainedServiceAccountPath?: string,
  ): Promise<PersistApplicationInput> {
    const serviceAccount = await inspectServiceAccount(
      retainedServiceAccountPath ?? request.serviceAccountPath,
    );
    const [android, ios, hooks] = await Promise.all([
      resolveAndroid(request.android),
      resolveIos(request.ios),
      resolveHooks(request.hooks),
    ]);
    const requestedProjectId = request.firebaseProjectId.trim();
    const firebaseProjectId = requestedProjectId || serviceAccount.projectId;
    const observedProjectIds = [serviceAccount.projectId, android.projectId, ios.projectId].filter(
      (projectId): projectId is string => projectId !== null,
    );
    if (observedProjectIds.some((projectId) => projectId !== firebaseProjectId)) {
      throw new Error('Service Account ve Google Services dosyaları aynı Firebase projesine ait değil.');
    }
    return {
      android: android.configuration,
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
      throw new Error('Güncellenecek uygulama bulunamadı.');
    }
    const createRequest: CreateApplicationRequest = {
      android: request.android,
      distributionGroups: request.distributionGroups,
      firebaseProjectId: request.firebaseProjectId,
      hooks: request.hooks,
      ios: request.ios,
      name: request.name,
      serviceAccountPath: request.serviceAccountPath ?? currentApplication.serviceAccountPath,
    };
    return this.repository.update(request.id, await this.resolveInput(createRequest));
  }
}
