const { spawn } = require('node:child_process');
const path = require('node:path');

const electronVitePackagePath = require.resolve('electron-vite/package.json');
const electronViteCliPath = path.join(
  path.dirname(electronVitePackagePath),
  'bin',
  'electron-vite.js',
);
const childEnvironment = { ...process.env };

delete childEnvironment.ELECTRON_RUN_AS_NODE;

const childProcess = spawn(
  process.execPath,
  [electronViteCliPath, ...process.argv.slice(2)],
  {
    env: childEnvironment,
    stdio: 'inherit',
  },
);

const signalExitCodes = {
  SIGHUP: 129,
  SIGINT: 130,
  SIGTERM: 143,
};
let receivedSignal = null;

for (const signal of Object.keys(signalExitCodes)) {
  process.once(signal, () => {
    receivedSignal = signal;
    childProcess.kill(signal);
  });
}

childProcess.once('error', (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

childProcess.once('exit', (exitCode, signal) => {
  const terminalSignal = receivedSignal ?? signal;
  process.exit(
    exitCode ?? (terminalSignal === null ? 1 : signalExitCodes[terminalSignal] ?? 1),
  );
});
