const { spawnSync } = require('node:child_process');

const runNodeScript = (label, scriptPath) => {
  process.stdout.write(`Preparing ${label}...\n`);

  const result = spawnSync(process.execPath, [scriptPath], {
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

runNodeScript('Electron runtime', require.resolve('electron/install.js'));
runNodeScript(
  'native application dependencies',
  require.resolve('electron-builder/install-app-deps.js'),
);
