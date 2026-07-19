const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const releaseRoot = path.join(projectRoot, 'releases');
const stagingRoot = path.join(releaseRoot, '.staging');
const runId = `${Date.now()}-${process.pid}`;
const runRoot = path.join(stagingRoot, runId);
const macBuilderOutput = path.join(runRoot, 'macos-builder');
const windowsBuilderOutput = path.join(runRoot, 'windows-builder');
const preparedRoot = path.join(runRoot, 'prepared');
const macPreparedOutput = path.join(preparedRoot, 'macos');
const windowsPreparedOutput = path.join(preparedRoot, 'windows');
const macReleaseOutput = path.join(releaseRoot, 'macos');
const windowsReleaseOutput = path.join(releaseRoot, 'windows');
const expectedMacArtifact = `LaunchDeck-${packageJson.version}-macos-universal.dmg`;
const expectedWindowsArtifact = `LaunchDeck-Setup-${packageJson.version}-windows-x64.exe`;
const signingEnvironmentPrefixes = ['APPLE_', 'CSC_', 'WIN_CSC_'];
const requiredElectronVersion = '42.2.0';
const requiredBetterSqliteVersion = '12.11.1';

let activeChild = null;
let receivedSignal = null;

const releaseEnvironment = { ...process.env };

for (const environmentKey of Object.keys(releaseEnvironment)) {
  if (
    signingEnvironmentPrefixes.some((prefix) =>
      environmentKey.startsWith(prefix),
    )
  ) {
    delete releaseEnvironment[environmentKey];
  }
}

delete releaseEnvironment.ELECTRON_RUN_AS_NODE;
releaseEnvironment.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
releaseEnvironment.NODE_ENV = 'production';

const resolvePackageScript = (packageName, relativeScriptPath) => {
  const packagePath = require.resolve(`${packageName}/package.json`);
  return path.join(path.dirname(packagePath), relativeScriptPath);
};

const electronViteCliPath = resolvePackageScript(
  'electron-vite',
  path.join('bin', 'electron-vite.js'),
);
const electronBuilderCliPath = resolvePackageScript(
  'electron-builder',
  'cli.js',
);
const electronBuilderInstallAppDepsPath = resolvePackageScript(
  'electron-builder',
  'install-app-deps.js',
);

const describeCommand = (executablePath, commandArguments) =>
  [path.basename(executablePath), ...commandArguments].join(' ');

const runCommand = async (
  label,
  executablePath,
  commandArguments,
  options = {},
) => {
  process.stdout.write(`\n${label}\n`);

  await new Promise((resolve, reject) => {
    const childProcess = spawn(executablePath, commandArguments, {
      cwd: projectRoot,
      env: releaseEnvironment,
      shell: false,
      stdio: options.captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let standardOutput = '';
    let standardError = '';

    activeChild = childProcess;

    if (options.captureOutput) {
      childProcess.stdout.setEncoding('utf8');
      childProcess.stderr.setEncoding('utf8');
      childProcess.stdout.on('data', (chunk) => {
        standardOutput += chunk;
      });
      childProcess.stderr.on('data', (chunk) => {
        standardError += chunk;
      });
    }

    childProcess.once('error', (error) => {
      activeChild = null;
      reject(error);
    });

    childProcess.once('exit', (exitCode, signal) => {
      activeChild = null;

      if (exitCode !== 0) {
        const diagnostic = options.captureOutput
          ? `\n${standardError || standardOutput}`
          : '';
        reject(
          new Error(
            `${label} failed (${describeCommand(
              executablePath,
              commandArguments,
            )}; exit ${exitCode ?? 'none'}; signal ${signal ?? 'none'}).${diagnostic}`,
          ),
        );
        return;
      }

      resolve({ standardError, standardOutput });
    });
  });
};

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    receivedSignal = signal;
    if (activeChild !== null) {
      activeChild.kill(signal);
    }
  });
}

const assertRegularFile = (filePath, label) => {
  let fileStat;

  try {
    fileStat = fs.statSync(filePath);
  } catch {
    throw new Error(`${label} was not created at ${filePath}.`);
  }

  if (!fileStat.isFile() || fileStat.size === 0) {
    throw new Error(`${label} is not a non-empty regular file: ${filePath}.`);
  }
};

const resolveExecutable = (executableNames) => {
  const searchDirectories = (process.env.PATH ?? '')
    .split(path.delimiter)
    .filter((searchDirectory) => searchDirectory.length > 0);

  for (const executableName of executableNames) {
    for (const searchDirectory of searchDirectories) {
      const executablePath = path.join(searchDirectory, executableName);
      try {
        fs.accessSync(executablePath, fs.constants.X_OK);
        return executablePath;
      } catch {
        // Continue searching approved executable names on PATH.
      }
    }
  }

  return null;
};

const assertSupportedNodeVersion = () => {
  const [majorVersion, minorVersion] = process.versions.node
    .split('.')
    .map((versionPart) => Number.parseInt(versionPart, 10));

  if (
    !Number.isInteger(majorVersion) ||
    !Number.isInteger(minorVersion) ||
    majorVersion < 22 ||
    (majorVersion === 22 && minorVersion < 12)
  ) {
    throw new Error(
      `Node.js 22.12 or later is required; found ${process.versions.node}.`,
    );
  }
};

const assertReleasePrerequisites = () => {
  if (process.platform !== 'darwin') {
    throw new Error(
      '`yarn release` must run on macOS because it creates a universal DMG.',
    );
  }

  assertSupportedNodeVersion();

  for (const requiredExecutable of ['/usr/bin/hdiutil', '/usr/bin/lipo']) {
    fs.accessSync(requiredExecutable, fs.constants.X_OK);
  }

  const wineExecutablePath = resolveExecutable(['wine64', 'wine']);
  if (wineExecutablePath === null) {
    throw new Error(
      'Wine is required for the Windows NSIS installer. Install it with `brew install --cask wine-stable`.',
    );
  }

  const installedElectronVersion = require('electron/package.json').version;
  const installedBetterSqliteVersion = require('better-sqlite3/package.json').version;

  if (installedElectronVersion !== requiredElectronVersion) {
    throw new Error(
      `Electron ${requiredElectronVersion} is required; found ${installedElectronVersion}. Run yarn install --frozen-lockfile.`,
    );
  }

  if (installedBetterSqliteVersion !== requiredBetterSqliteVersion) {
    throw new Error(
      `better-sqlite3 ${requiredBetterSqliteVersion} is required; found ${installedBetterSqliteVersion}.`,
    );
  }

  return wineExecutablePath;
};

const collectFiles = (directoryPath) => {
  const collectedFiles = [];

  for (const directoryEntry of fs.readdirSync(directoryPath, {
    withFileTypes: true,
  })) {
    const entryPath = path.join(directoryPath, directoryEntry.name);
    if (directoryEntry.isDirectory()) {
      collectedFiles.push(...collectFiles(entryPath));
    } else if (directoryEntry.isFile()) {
      collectedFiles.push(entryPath);
    }
  }

  return collectedFiles;
};

const assertObfuscatedProductionOutput = () => {
  const runtimeDirectories = [
    path.join(projectRoot, 'out', 'main'),
    path.join(projectRoot, 'out', 'preload'),
    path.join(projectRoot, 'out', 'renderer'),
  ];

  for (const runtimeDirectory of runtimeDirectories) {
    const runtimeFiles = collectFiles(runtimeDirectory);
    const javaScriptFiles = runtimeFiles.filter((filePath) =>
      filePath.endsWith('.js'),
    );

    if (runtimeFiles.some((filePath) => filePath.endsWith('.map'))) {
      throw new Error(
        `Production source maps must not be present under ${runtimeDirectory}.`,
      );
    }

    if (javaScriptFiles.length === 0) {
      throw new Error(`No JavaScript bundle was created under ${runtimeDirectory}.`);
    }

    const hasObfuscatedIdentifier = javaScriptFiles.some((filePath) =>
      /_0x[0-9a-f]{4,}/i.test(fs.readFileSync(filePath, 'utf8')),
    );

    if (!hasObfuscatedIdentifier) {
      throw new Error(
        `The expected production obfuscation signature was not found under ${runtimeDirectory}.`,
      );
    }
  }
};

const readPeMetadata = (filePath) => {
  const fileBuffer = fs.readFileSync(filePath);

  if (fileBuffer.length < 256 || fileBuffer.readUInt16LE(0) !== 0x5a4d) {
    throw new Error(`Expected a Windows PE file: ${filePath}.`);
  }

  const peHeaderOffset = fileBuffer.readUInt32LE(0x3c);
  if (
    peHeaderOffset + 256 > fileBuffer.length ||
    fileBuffer.toString('ascii', peHeaderOffset, peHeaderOffset + 4) !==
      'PE\u0000\u0000'
  ) {
    throw new Error(`Invalid Windows PE header: ${filePath}.`);
  }

  const machine = fileBuffer.readUInt16LE(peHeaderOffset + 4);
  const optionalHeaderOffset = peHeaderOffset + 24;
  const optionalHeaderMagic = fileBuffer.readUInt16LE(optionalHeaderOffset);
  const dataDirectoryOffset =
    optionalHeaderMagic === 0x20b
      ? optionalHeaderOffset + 112
      : optionalHeaderMagic === 0x10b
        ? optionalHeaderOffset + 96
        : null;

  if (dataDirectoryOffset === null || dataDirectoryOffset + 40 > fileBuffer.length) {
    throw new Error(`Unsupported Windows PE optional header: ${filePath}.`);
  }

  return {
    certificateTableSize: fileBuffer.readUInt32LE(dataDirectoryOffset + 36),
    machine,
  };
};

const assertUnsignedWindowsPeFile = (
  filePath,
  label,
  expectedMachine = null,
) => {
  const peMetadata = readPeMetadata(filePath);

  if (expectedMachine !== null && peMetadata.machine !== expectedMachine) {
    throw new Error(`${label} is not an x64 PE file: ${filePath}.`);
  }

  if (peMetadata.certificateTableSize !== 0) {
    throw new Error(`${label} unexpectedly contains an Authenticode signature.`);
  }
};

const assertUniversalMachO = async (filePath, label) => {
  const { standardOutput } = await runCommand(
    `Verifying ${label} architectures`,
    '/usr/bin/lipo',
    ['-archs', filePath],
    { captureOutput: true },
  );
  const architectures = new Set(standardOutput.trim().split(/\s+/));

  if (!architectures.has('arm64') || !architectures.has('x86_64')) {
    throw new Error(
      `${label} must contain arm64 and x86_64 slices; found ${standardOutput.trim()}.`,
    );
  }
};

const assertUnsignedMacApplication = async (applicationPath) => {
  try {
    await runCommand(
      'Checking that the macOS application is unsigned',
      '/usr/bin/codesign',
      ['--verify', '--deep', '--strict', applicationPath],
      { captureOutput: true },
    );
  } catch {
    return;
  }

  throw new Error('The macOS application is signed, but releases must be unsigned.');
};

const calculateSha256 = (filePath) => {
  const hash = crypto.createHash('sha256');
  const fileDescriptor = fs.openSync(filePath, 'r');
  const readBuffer = Buffer.allocUnsafe(1024 * 1024);

  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(fileDescriptor, readBuffer, 0, readBuffer.length);
      if (bytesRead > 0) {
        hash.update(readBuffer.subarray(0, bytesRead));
      }
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fileDescriptor);
  }

  return hash.digest('hex');
};

const prepareArtifact = (sourcePath, preparedDirectory) => {
  fs.mkdirSync(preparedDirectory, { recursive: true });
  const artifactName = path.basename(sourcePath);
  const destinationPath = path.join(preparedDirectory, artifactName);
  fs.copyFileSync(sourcePath, destinationPath);
  fs.writeFileSync(
    `${destinationPath}.sha256`,
    `${calculateSha256(destinationPath)}  ${artifactName}\n`,
    { mode: 0o644 },
  );
};

const promotePreparedOutputs = () => {
  const promotions = [
    { preparedPath: macPreparedOutput, releasePath: macReleaseOutput },
    {
      preparedPath: windowsPreparedOutput,
      releasePath: windowsReleaseOutput,
    },
  ].map((promotion) => ({
    ...promotion,
    backupPath: `${promotion.releasePath}.backup-${runId}`,
    hasBackup: false,
    isPromoted: false,
  }));

  fs.mkdirSync(releaseRoot, { recursive: true });

  try {
    for (const promotion of promotions) {
      if (fs.existsSync(promotion.releasePath)) {
        fs.renameSync(promotion.releasePath, promotion.backupPath);
        promotion.hasBackup = true;
      }
    }

    for (const promotion of promotions) {
      fs.renameSync(promotion.preparedPath, promotion.releasePath);
      promotion.isPromoted = true;
    }

    for (const promotion of promotions) {
      if (promotion.hasBackup) {
        fs.rmSync(promotion.backupPath, { force: true, recursive: true });
      }
    }
  } catch (error) {
    for (const promotion of promotions.reverse()) {
      if (promotion.isPromoted && fs.existsSync(promotion.releasePath)) {
        fs.rmSync(promotion.releasePath, { force: true, recursive: true });
      }
      if (promotion.hasBackup && fs.existsSync(promotion.backupPath)) {
        fs.renameSync(promotion.backupPath, promotion.releasePath);
      }
    }
    throw error;
  }
};

const restoreHostNativeDependencies = async () => {
  await runCommand(
    'Restoring host-native application dependencies',
    process.execPath,
    [electronBuilderInstallAppDepsPath],
  );
};

const executeRelease = async () => {
  const wineExecutablePath = assertReleasePrerequisites();
  process.stdout.write(
    `Creating unsigned installers with ${path.basename(wineExecutablePath)}.\n`,
  );

  fs.mkdirSync(runRoot, { recursive: true });

  await runCommand('Building obfuscated production bundles', process.execPath, [
    electronViteCliPath,
    'build',
  ]);
  assertObfuscatedProductionOutput();

  await runCommand('Packaging universal macOS DMG', process.execPath, [
    electronBuilderCliPath,
    '--mac',
    'dmg',
    '--universal',
    `--config.directories.output=${macBuilderOutput}`,
    '--publish',
    'never',
  ]);

  const macApplicationPath = path.join(
    macBuilderOutput,
    'mac-universal',
    'LaunchDeck.app',
  );
  const macExecutablePath = path.join(
    macApplicationPath,
    'Contents',
    'MacOS',
    'LaunchDeck',
  );
  const macNativeBindingPath = path.join(
    macApplicationPath,
    'Contents',
    'Resources',
    'app.asar.unpacked',
    'node_modules',
    'better-sqlite3',
    'build',
    'Release',
    'better_sqlite3.node',
  );
  const macArtifactPath = path.join(macBuilderOutput, expectedMacArtifact);

  assertRegularFile(macExecutablePath, 'macOS application executable');
  assertRegularFile(macNativeBindingPath, 'macOS better-sqlite3 binding');
  assertRegularFile(macArtifactPath, 'macOS DMG');
  await assertUniversalMachO(macExecutablePath, 'macOS application');
  await assertUniversalMachO(macNativeBindingPath, 'macOS better-sqlite3 binding');
  await assertUnsignedMacApplication(macApplicationPath);
  await runCommand('Verifying macOS DMG', '/usr/bin/hdiutil', [
    'verify',
    macArtifactPath,
  ]);

  await runCommand('Packaging Windows x64 NSIS installer', process.execPath, [
    electronBuilderCliPath,
    '--win',
    'nsis',
    '--x64',
    `--config.directories.output=${windowsBuilderOutput}`,
    '--publish',
    'never',
  ]);

  const windowsUnpackedPath = path.join(windowsBuilderOutput, 'win-unpacked');
  const windowsExecutablePath = path.join(
    windowsUnpackedPath,
    'LaunchDeck.exe',
  );
  const windowsNativeBindingPath = path.join(
    windowsUnpackedPath,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    'better-sqlite3',
    'build',
    'Release',
    'better_sqlite3.node',
  );
  const windowsArtifactPath = path.join(
    windowsBuilderOutput,
    expectedWindowsArtifact,
  );

  assertRegularFile(windowsExecutablePath, 'Windows application executable');
  assertRegularFile(windowsNativeBindingPath, 'Windows better-sqlite3 binding');
  assertRegularFile(windowsArtifactPath, 'Windows NSIS installer');
  assertUnsignedWindowsPeFile(
    windowsExecutablePath,
    'Windows application executable',
    0x8664,
  );
  assertUnsignedWindowsPeFile(
    windowsNativeBindingPath,
    'Windows better-sqlite3 binding',
    0x8664,
  );
  assertUnsignedWindowsPeFile(windowsArtifactPath, 'Windows NSIS installer');

  prepareArtifact(macArtifactPath, macPreparedOutput);
  prepareArtifact(windowsArtifactPath, windowsPreparedOutput);
  promotePreparedOutputs();

  process.stdout.write(
    `\nRelease complete:\n- ${path.relative(
      projectRoot,
      path.join(macReleaseOutput, expectedMacArtifact),
    )}\n- ${path.relative(
      projectRoot,
      path.join(windowsReleaseOutput, expectedWindowsArtifact),
    )}\n`,
  );
};

const main = async () => {
  let releaseError = null;

  try {
    await executeRelease();
  } catch (error) {
    releaseError = error;
  }

  try {
    if (fs.existsSync(runRoot)) {
      await restoreHostNativeDependencies();
    }
  } catch (restoreError) {
    releaseError =
      releaseError === null
        ? restoreError
        : new Error(
            `${releaseError.message}\nAdditionally, host dependency restoration failed: ${restoreError.message}`,
          );
  } finally {
    fs.rmSync(runRoot, { force: true, recursive: true });
  }

  if (receivedSignal !== null) {
    process.stderr.write(`Release cancelled by ${receivedSignal}.\n`);
    process.exitCode = receivedSignal === 'SIGINT' ? 130 : 143;
    return;
  }

  if (releaseError !== null) {
    process.stderr.write(`${releaseError.message}\n`);
    process.exitCode = 1;
  }
};

void main();
