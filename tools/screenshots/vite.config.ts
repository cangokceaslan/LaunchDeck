import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

const repositoryRoot = path.resolve('.');

export default defineConfig({
  plugins: [react({})],
  resolve: {
    alias: {
      '@components': path.resolve('src/renderer/components'),
      '@hooks': path.resolve('src/renderer/hooks'),
      '@renderer': path.resolve('src/renderer'),
      '@screens': path.resolve('src/renderer/screens'),
      '@screenshots': path.resolve('tools/screenshots'),
      '@shared': path.resolve('src/shared'),
      '@themes': path.resolve('src/renderer/themes'),
    },
  },
  root: path.resolve('tools/screenshots'),
  server: {
    fs: { allow: [repositoryRoot] },
    host: '127.0.0.1',
    port: 4178,
    strictPort: true,
  },
});
