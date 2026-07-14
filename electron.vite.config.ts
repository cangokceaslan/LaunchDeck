import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import JavaScriptObfuscator from 'javascript-obfuscator';
import path from 'node:path';
import type { Plugin } from 'vite';

const createProductionObfuscationPlugin = (): Plugin => ({
  apply: 'build',
  name: 'launchdeck-production-obfuscation',
  renderChunk(sourceCode) {
    const result = JavaScriptObfuscator.obfuscate(sourceCode, {
      compact: true,
      identifierNamesGenerator: 'hexadecimal',
      numbersToExpressions: true,
      renameGlobals: false,
      selfDefending: false,
      simplify: true,
      splitStrings: true,
      splitStringsChunkLength: 8,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.75,
      transformObjectKeys: true,
      unicodeEscapeSequence: false,
    });

    return { code: result.getObfuscatedCode(), map: null };
  },
});

const buildOptions = { minify: true, sourcemap: false } as const;

export default defineConfig({
  main: {
    build: buildOptions,
    plugins: [
      externalizeDepsPlugin({ exclude: ['plist'] }),
      createProductionObfuscationPlugin(),
    ],
    resolve: {
      alias: {
        '@main': path.resolve('src/main'),
        '@shared': path.resolve('src/shared'),
      },
    },
  },
  preload: {
    build: buildOptions,
    plugins: [externalizeDepsPlugin(), createProductionObfuscationPlugin()],
    resolve: {
      alias: {
        '@preload': path.resolve('src/preload'),
        '@shared': path.resolve('src/shared'),
      },
    },
  },
  renderer: {
    build: buildOptions,
    plugins: [react({}), createProductionObfuscationPlugin()],
    resolve: {
      alias: {
        '@components': path.resolve('src/renderer/components'),
        '@hooks': path.resolve('src/renderer/hooks'),
        '@renderer': path.resolve('src/renderer'),
        '@screens': path.resolve('src/renderer/screens'),
        '@shared': path.resolve('src/shared'),
        '@themes': path.resolve('src/renderer/themes'),
      },
    },
  },
});
