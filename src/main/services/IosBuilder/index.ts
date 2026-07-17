import { access, chmod, copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type {
  AppStoreConnectSetupConfiguration,
  IosConfiguration,
  IosProjectMetadataRequest,
  IosProjectMetadataResult,
  IosSchemeListResult,
  IosSigningConfiguration,
} from '@shared/contracts/domain';
import type { ProcessOutput } from '@main/utils/ChildProcess/index.types';
import { findExecutable } from '@main/utils/Executable';
import {
  isRecord,
  replaceTextFileAtomically,
  resolveExistingBundlePath,
  resolveExistingDirectory,
  resolveExistingFile,
} from '@main/utils/FileSystem';
import { runExecutable } from '@main/utils/ChildProcess';
import type { ResolvedReleaseVersion } from '@shared/contracts/release';

const MAX_SCHEME_OUTPUT_LENGTH = 1024 * 1024;
const MAX_BUILD_SETTINGS_OUTPUT_LENGTH = 4 * 1024 * 1024;
const MAX_VERSION_FILE_BYTES = 8 * 1024 * 1024;
const MARKETING_VERSION_PATTERN = /^([ \t]*MARKETING_VERSION[ \t]*=[ \t]*)[^;\r\n]+([ \t]*;[^\r\n]*\r?)$/gmu;
const BUILD_NUMBER_PATTERN = /^([ \t]*CURRENT_PROJECT_VERSION[ \t]*=[ \t]*)[^;\r\n]+([ \t]*;[^\r\n]*\r?)$/gmu;

type IosVersionFile = {
  contents: string;
  path: string;
};

const isPathInside = (parentPath: string, childPath: string): boolean => {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
};

const readIosVersionFile = async (
  projectBundlePath: string,
  projectRootPath: string,
): Promise<IosVersionFile | null> => {
  let projectFilePath: string;
  try {
    projectFilePath = await resolveExistingFile(path.join(projectBundlePath, 'project.pbxproj'), [
      '.pbxproj',
    ]);
  } catch {
    return null;
  }
  if (!isPathInside(projectRootPath, projectFilePath)) {
    throw new Error('The Xcode project file must remain inside the selected iOS project directory.');
  }
  const fileStats = await lstat(projectFilePath);
  if (fileStats.size > MAX_VERSION_FILE_BYTES) {
    throw new Error('The Xcode project configuration exceeds the supported size.');
  }
  const contents = await readFile(projectFilePath, 'utf8');
  if (!MARKETING_VERSION_PATTERN.test(contents) || !BUILD_NUMBER_PATTERN.test(contents)) {
    MARKETING_VERSION_PATTERN.lastIndex = 0;
    BUILD_NUMBER_PATTERN.lastIndex = 0;
    return null;
  }
  MARKETING_VERSION_PATTERN.lastIndex = 0;
  BUILD_NUMBER_PATTERN.lastIndex = 0;
  await access(projectFilePath, constants.W_OK);
  return { contents, path: projectFilePath };
};

const readWorkspaceProjectLocations = async (workspacePath: string): Promise<string[]> => {
  const workspaceDataPath = await resolveExistingFile(
    path.join(workspacePath, 'contents.xcworkspacedata'),
    ['.xcworkspacedata'],
  );
  const workspaceDataStats = await lstat(workspaceDataPath);
  if (workspaceDataStats.size > MAX_VERSION_FILE_BYTES) {
    throw new Error('The Xcode workspace configuration exceeds the supported size.');
  }
  const contents = await readFile(workspaceDataPath, 'utf8');
  const projectLocations = [...contents.matchAll(/location\s*=\s*"(?:group:|container:)?([^"\r\n]+\.xcodeproj)"/gu)]
    .map((match) => match[1])
    .filter((location): location is string => location !== undefined)
    .map((location) => location.replaceAll('&amp;', '&'));
  return [...new Set(projectLocations)];
};

const resolveVersionFile = async (configuration: IosConfiguration): Promise<IosVersionFile> => {
  const projectRootPath = await resolveExistingDirectory(configuration.projectPath);
  const selectedBundlePath = await resolveExistingBundlePath(configuration.workspaceOrProjectPath, [
    '.xcworkspace',
    '.xcodeproj',
  ]);
  const candidateBundlePaths = selectedBundlePath.endsWith('.xcodeproj')
    ? [selectedBundlePath]
    : [
        path.join(
          path.dirname(selectedBundlePath),
          `${path.basename(selectedBundlePath, '.xcworkspace')}.xcodeproj`,
        ),
        ...(await readWorkspaceProjectLocations(selectedBundlePath)).map((location) =>
          path.resolve(path.dirname(selectedBundlePath), location),
        ),
      ];
  const matches: IosVersionFile[] = [];
  for (const candidatePath of [...new Set(candidateBundlePaths)]) {
    if (path.basename(candidatePath).toLocaleLowerCase('en-US') === 'pods.xcodeproj') continue;
    const match = await readIosVersionFile(candidatePath, projectRootPath);
    if (match !== null) matches.push(match);
  }
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? 'A writable Xcode project.pbxproj with MARKETING_VERSION and CURRENT_PROJECT_VERSION was not found.'
        : 'More than one Xcode project defines release versions in the selected workspace.',
    );
  }
  const versionFile = matches[0];
  if (versionFile === undefined) {
    throw new Error('The iOS version file could not be resolved.');
  }
  return versionFile;
};

const readSchemes = (output: string): string[] => {
  const jsonStart = output.indexOf('{');
  const jsonEnd = output.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd < jsonStart) {
    throw new Error('The Xcode scheme list did not return readable JSON.');
  }
  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(output.slice(jsonStart, jsonEnd + 1));
  } catch {
    throw new Error('The Xcode scheme list returned invalid JSON.');
  }
  if (!isRecord(parsedOutput)) {
    throw new Error('The Xcode scheme list is invalid.');
  }
  const container = isRecord(parsedOutput.workspace)
    ? parsedOutput.workspace
    : isRecord(parsedOutput.project)
      ? parsedOutput.project
      : null;
  if (container === null || !Array.isArray(container.schemes)) {
    throw new Error('No scheme list was found in the selected Xcode project.');
  }
  const schemes = container.schemes.filter(
    (scheme): scheme is string => typeof scheme === 'string' && scheme.trim() !== '',
  );
  return [...new Set(schemes.map((scheme) => scheme.trim()))].sort((left, right) =>
    left.localeCompare(right, 'en-US'),
  );
};

const readProjectMetadata = (output: string): IosProjectMetadataResult => {
  const jsonStart = output.indexOf('[');
  const jsonEnd = output.lastIndexOf(']');
  if (jsonStart === -1 || jsonEnd < jsonStart) {
    throw new Error('The Xcode build settings did not return readable JSON.');
  }
  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(output.slice(jsonStart, jsonEnd + 1));
  } catch {
    throw new Error('The Xcode build settings returned invalid JSON.');
  }
  if (!Array.isArray(parsedOutput)) {
    throw new Error('The Xcode build settings are invalid.');
  }
  const applicationBuildSettings = parsedOutput.flatMap((targetSettings) => {
    if (!isRecord(targetSettings) || !isRecord(targetSettings.buildSettings)) {
      return [];
    }
    const productType = targetSettings.buildSettings.PRODUCT_TYPE;
    const wrapperExtension = targetSettings.buildSettings.WRAPPER_EXTENSION;
    return productType === 'com.apple.product-type.application' || wrapperExtension === 'app'
      ? [targetSettings.buildSettings]
      : [];
  });
  if (applicationBuildSettings.length === 0) {
    throw new Error('No iOS application target was found for the selected Xcode scheme.');
  }
  const developmentTeamIds = applicationBuildSettings.flatMap((buildSettings) => {
    const developmentTeamId = buildSettings.DEVELOPMENT_TEAM;
    return typeof developmentTeamId === 'string' && /^[A-Z0-9]{1,64}$/u.test(developmentTeamId)
      ? [developmentTeamId]
      : [];
  });
  const bundleIdentifiers = applicationBuildSettings.flatMap((buildSettings) => {
    const bundleIdentifier = buildSettings.PRODUCT_BUNDLE_IDENTIFIER;
    return typeof bundleIdentifier === 'string' &&
      /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/u.test(bundleIdentifier)
      ? [bundleIdentifier]
      : [];
  });
  const uniqueDevelopmentTeamIds = [...new Set(developmentTeamIds)];
  const uniqueBundleIdentifiers = [...new Set(bundleIdentifiers)];
  if (uniqueDevelopmentTeamIds.length === 0) {
    throw new Error('No Apple Development Team ID was found for the selected Xcode scheme and configuration.');
  }
  if (uniqueDevelopmentTeamIds.length > 1) {
    throw new Error('More than one Apple Development Team ID is configured for the selected Xcode scheme and configuration.');
  }
  if (uniqueBundleIdentifiers.length === 0) {
    throw new Error('No Bundle ID was found for the selected Xcode scheme and configuration.');
  }
  if (uniqueBundleIdentifiers.length > 1) {
    throw new Error('More than one Bundle ID is configured for the selected Xcode scheme and configuration.');
  }
  const developmentTeamId = uniqueDevelopmentTeamIds[0];
  const bundleIdentifier = uniqueBundleIdentifiers[0];
  if (developmentTeamId === undefined || bundleIdentifier === undefined) {
    throw new Error('The iOS project signing metadata could not be resolved.');
  }
  return { bundleIdentifier, developmentTeamId };
};

const createExportOptions = (method: string, destination: 'export' | 'upload'): string => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>${method}</string>
<key>signingStyle</key><string>automatic</string>
<key>destination</key><string>${destination}</string>
<key>stripSwiftSymbols</key><true/>
</dict></plist>`;

export type IosBuildDistributionOptions = {
  appStoreConnect?: AppStoreConnectSetupConfiguration;
  signing?: IosSigningConfiguration;
};

export class IosBuilder {
  public async resolveXcodeBuild(): Promise<string> {
    const executablePath = await findExecutable('xcodebuild');
    if (executablePath === null) {
      throw new Error('xcodebuild was not found.');
    }
    return executablePath;
  }

  public async validateVersionConfiguration(configuration: IosConfiguration): Promise<void> {
    await resolveVersionFile(configuration);
  }

  public async verifyIpaSignature(artifactPath: string): Promise<void> {
    if (process.platform !== 'darwin') throw new Error('IPA signatures can be verified only on macOS.');
    const dittoPath = await findExecutable('ditto');
    const codeSignPath = await findExecutable('codesign');
    if (dittoPath === null || codeSignPath === null) {
      throw new Error('ditto and codesign are required to verify an IPA signature.');
    }
    const extractionPath = await mkdtemp(path.join(tmpdir(), 'launchdeck-ipa-'));
    try {
      const extractionResult = await runExecutable({
        args: ['-x', '-k', artifactPath, extractionPath],
        cwdPath: extractionPath,
        executablePath: dittoPath,
        onOutput: () => undefined,
        signal: new AbortController().signal,
      });
      if (extractionResult.exitCode !== 0) throw new Error('The IPA could not be inspected.');
      const payloadPath = await resolveExistingDirectory(path.join(extractionPath, 'Payload'));
      const applicationBundles = (await readdir(payloadPath)).filter((name) =>
        name.toLocaleLowerCase('en-US').endsWith('.app'),
      );
      const applicationBundle = applicationBundles[0];
      if (applicationBundles.length !== 1 || applicationBundle === undefined) {
        throw new Error('Exactly one application bundle was not found in the IPA.');
      }
      const verificationResult = await runExecutable({
        args: ['--verify', '--deep', '--strict', path.join(payloadPath, applicationBundle)],
        cwdPath: extractionPath,
        executablePath: codeSignPath,
        onOutput: () => undefined,
        signal: new AbortController().signal,
      });
      if (verificationResult.exitCode !== 0) throw new Error('The selected IPA signature is invalid.');
    } finally {
      await rm(extractionPath, { force: true, recursive: true });
    }
  }

  public async applyVersion(
    configuration: IosConfiguration,
    version: ResolvedReleaseVersion,
  ): Promise<void> {
    if (version.iosBuildNumber === undefined) {
      throw new Error('The iOS build number is missing from the release plan.');
    }
    const versionFile = await resolveVersionFile(configuration);
    const withMarketingVersion = versionFile.contents.replace(
      MARKETING_VERSION_PATTERN,
      (_match, prefix: string, suffix: string) => `${prefix}${version.versionName}${suffix}`,
    );
    const updatedContents = withMarketingVersion.replace(
      BUILD_NUMBER_PATTERN,
      (_match, prefix: string, suffix: string) => `${prefix}${version.iosBuildNumber}${suffix}`,
    );
    await replaceTextFileAtomically(versionFile.path, updatedContents);
  }

  public async listSchemes(workspaceOrProjectPath: string): Promise<IosSchemeListResult> {
    if (process.platform !== 'darwin') {
      throw new Error('Xcode schemes can be read only on macOS.');
    }
    const resolvedBundlePath = await resolveExistingBundlePath(workspaceOrProjectPath, [
      '.xcworkspace',
      '.xcodeproj',
    ]);
    const xcodeBuildPath = await this.resolveXcodeBuild();
    const projectFlag = resolvedBundlePath.endsWith('.xcworkspace') ? '-workspace' : '-project';
    const outputLines: string[] = [];
    let outputLength = 0;
    const result = await runExecutable({
      args: ['-list', '-json', projectFlag, resolvedBundlePath],
      cwdPath: path.dirname(resolvedBundlePath),
      executablePath: xcodeBuildPath,
      onOutput: ({ level, line }) => {
        if (level === 'info' && outputLength < MAX_SCHEME_OUTPUT_LENGTH) {
          outputLines.push(line);
          outputLength += line.length + 1;
        }
      },
      signal: new AbortController().signal,
    });
    if (result.exitCode !== 0) {
      throw new Error(`The Xcode scheme list could not be read. Exit code: ${result.exitCode}.`);
    }
    const schemes = readSchemes(outputLines.join('\n'));
    if (schemes.length === 0) {
      throw new Error('No available schemes were found in the selected Xcode project.');
    }
    return { schemes };
  }

  public async resolveProjectMetadata(
    request: IosProjectMetadataRequest,
  ): Promise<IosProjectMetadataResult> {
    if (process.platform !== 'darwin') {
      throw new Error('Xcode project metadata can be read only on macOS.');
    }
    const resolvedBundlePath = await resolveExistingBundlePath(request.workspaceOrProjectPath, [
      '.xcworkspace',
      '.xcodeproj',
    ]);
    const xcodeBuildPath = await this.resolveXcodeBuild();
    const projectFlag = resolvedBundlePath.endsWith('.xcworkspace') ? '-workspace' : '-project';
    const outputLines: string[] = [];
    let isOutputTruncated = false;
    let outputLength = 0;
    const result = await runExecutable({
      args: [
        projectFlag,
        resolvedBundlePath,
        '-scheme',
        request.scheme,
        '-configuration',
        request.configuration,
        '-showBuildSettings',
        '-json',
      ],
      cwdPath: path.dirname(resolvedBundlePath),
      executablePath: xcodeBuildPath,
      maxLineLength: MAX_BUILD_SETTINGS_OUTPUT_LENGTH + 1,
      onOutput: ({ level, line }) => {
        if (level !== 'info') return;
        if (outputLength + line.length + 1 > MAX_BUILD_SETTINGS_OUTPUT_LENGTH) {
          isOutputTruncated = true;
          return;
        }
        outputLines.push(line);
        outputLength += line.length + 1;
      },
      signal: new AbortController().signal,
    });
    if (result.exitCode !== 0) {
      throw new Error(`The Xcode build settings could not be read. Exit code: ${result.exitCode}.`);
    }
    if (isOutputTruncated) {
      throw new Error('The Xcode build settings exceed the supported size.');
    }
    return readProjectMetadata(outputLines.join('\n'));
  }

  public async build(
    configuration: IosConfiguration,
    runWorkspacePath: string,
    signal: AbortSignal,
    onOutput: (output: ProcessOutput) => void,
    distribution: IosBuildDistributionOptions = {},
  ): Promise<string> {
    if (process.platform !== 'darwin') {
      throw new Error('iOS builds can run only on macOS.');
    }
    const xcodeBuildPath = await this.resolveXcodeBuild();
    const archivePath = path.join(runWorkspacePath, 'application.xcarchive');
    const exportPath = path.join(runWorkspacePath, 'export');
    const exportOptionsPath = path.join(runWorkspacePath, 'ExportOptions.plist');
    await mkdir(runWorkspacePath, { mode: 0o700, recursive: true });
    await writeFile(exportOptionsPath, createExportOptions(configuration.exportMethod, 'export'), { mode: 0o600 });
    const projectFlag = configuration.workspaceOrProjectPath.endsWith('.xcworkspace')
      ? '-workspace'
      : '-project';

    try {
      const signingArgs = distribution.signing?.isEnabled === true
        ? [
            'CODE_SIGN_STYLE=Automatic',
            `DEVELOPMENT_TEAM=${distribution.signing.developmentTeamId}`,
            '-allowProvisioningUpdates',
          ]
        : [];
      const authenticationArgs = distribution.appStoreConnect === undefined
        ? []
        : [
            '-authenticationKeyPath', distribution.appStoreConnect.apiKeyPath,
            '-authenticationKeyID', distribution.appStoreConnect.apiKeyId,
            '-authenticationKeyIssuerID', distribution.appStoreConnect.issuerId,
          ];
      const archiveResult = await runExecutable({
        args: [
          projectFlag,
          configuration.workspaceOrProjectPath,
          '-scheme',
          configuration.scheme,
          '-configuration',
          configuration.configuration,
          '-destination',
          'generic/platform=iOS',
          '-archivePath',
          archivePath,
          'clean',
          'archive',
          ...signingArgs,
          ...authenticationArgs,
        ],
        cwdPath: configuration.projectPath,
        executablePath: xcodeBuildPath,
        onOutput,
        signal,
      });
      if (archiveResult.exitCode !== 0) {
        throw new Error(`iOS archive failed with exit code ${archiveResult.exitCode}.`);
      }
      if (distribution.signing?.isEnabled === true) {
        const applicationDirectory = path.join(archivePath, 'Products', 'Applications');
        const applicationBundles = (await readdir(applicationDirectory)).filter((name) =>
          name.toLocaleLowerCase('en-US').endsWith('.app'),
        );
        const applicationBundle = applicationBundles[0];
        if (applicationBundles.length !== 1 || applicationBundle === undefined) {
          throw new Error('Exactly one signed application bundle was not found in the Xcode archive.');
        }
        const codeSignPath = await findExecutable('codesign');
        if (codeSignPath === null) throw new Error('codesign was not found.');
        const verificationResult = await runExecutable({
          args: ['--verify', '--deep', '--strict', path.join(applicationDirectory, applicationBundle)],
          cwdPath: configuration.projectPath,
          executablePath: codeSignPath,
          onOutput,
          signal,
        });
        if (verificationResult.exitCode !== 0) {
          throw new Error('The iOS archive signature could not be verified.');
        }
      }
      const exportResult = await runExecutable({
        args: [
          '-exportArchive',
          '-archivePath',
          archivePath,
          '-exportPath',
          exportPath,
          '-exportOptionsPlist',
          exportOptionsPath,
        ],
        cwdPath: configuration.projectPath,
        executablePath: xcodeBuildPath,
        onOutput,
        signal,
      });
      if (exportResult.exitCode !== 0) {
        throw new Error(`iOS export failed with exit code ${exportResult.exitCode}.`);
      }
      const exportedFiles = await readdir(exportPath);
      const ipaFiles = exportedFiles.filter((fileName) => fileName.toLowerCase().endsWith('.ipa'));
      if (ipaFiles.length !== 1) {
        throw new Error('Exactly one IPA file was not found in the iOS export directory.');
      }
      await mkdir(path.dirname(configuration.artifactPath), { mode: 0o700, recursive: true });
      await copyFile(path.join(exportPath, ipaFiles[0]), configuration.artifactPath);
      await chmod(configuration.artifactPath, 0o600);
      const artifactPath = await resolveExistingFile(configuration.artifactPath, ['.ipa']);
      return artifactPath;
    } finally {
      await rm(exportOptionsPath, { force: true });
    }
  }

  public async uploadArchiveToAppStore(
    configuration: IosConfiguration,
    runWorkspacePath: string,
    appStoreConnect: AppStoreConnectSetupConfiguration,
    signal: AbortSignal,
    onOutput: (output: ProcessOutput) => void,
  ): Promise<void> {
    const xcodeBuildPath = await this.resolveXcodeBuild();
    const archivePath = path.join(runWorkspacePath, 'application.xcarchive');
    const uploadOptionsPath = path.join(runWorkspacePath, 'AppStoreExportOptions.plist');
    await resolveExistingBundlePath(archivePath, ['.xcarchive']);
    await writeFile(uploadOptionsPath, createExportOptions('app-store-connect', 'upload'), {
      mode: 0o600,
    });
    try {
      const result = await runExecutable({
        args: [
          '-exportArchive',
          '-archivePath', archivePath,
          '-exportPath', path.join(runWorkspacePath, 'app-store-upload'),
          '-exportOptionsPlist', uploadOptionsPath,
          '-allowProvisioningUpdates',
          '-authenticationKeyPath', appStoreConnect.apiKeyPath,
          '-authenticationKeyID', appStoreConnect.apiKeyId,
          '-authenticationKeyIssuerID', appStoreConnect.issuerId,
        ],
        cwdPath: configuration.projectPath,
        executablePath: xcodeBuildPath,
        onOutput,
        signal,
      });
      if (result.exitCode !== 0) {
        throw new Error(`App Store Connect upload failed with exit code ${result.exitCode}.`);
      }
    } finally {
      await rm(uploadOptionsPath, { force: true });
    }
  }
}
