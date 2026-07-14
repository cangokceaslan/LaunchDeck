import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import JavaScriptObfuscator from 'javascript-obfuscator';
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
      selfDefending: true,
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
    plugins: [externalizeDepsPlugin(), createProductionObfuscationPlugin()],
    resolve: {
      alias: {
        '@main': new URL('./src/main', import.meta.url).pathname,
        '@shared': new URL('./src/shared', import.meta.url).pathname,
      },
    },
  },
  preload: {
    build: buildOptions,
    plugins: [externalizeDepsPlugin(), createProductionObfuscationPlugin()],
    resolve: {
      alias: {
        '@preload': new URL('./src/preload', import.meta.url).pathname,
        '@shared': new URL('./src/shared', import.meta.url).pathname,
      },
    },
  },
  renderer: {
    build: buildOptions,
    plugins: [react(), createProductionObfuscationPlugin()],
    resolve: {
      alias: {
        '@components': new URL('./src/renderer/components', import.meta.url).pathname,
        '@hooks': new URL('./src/renderer/hooks', import.meta.url).pathname,
        '@renderer': new URL('./src/renderer', import.meta.url).pathname,
        '@screens': new URL('./src/renderer/screens', import.meta.url).pathname,
        '@shared': new URL('./src/shared', import.meta.url).pathname,
        '@themes': new URL('./src/renderer/themes', import.meta.url).pathname,
      },
    },
  },
});
