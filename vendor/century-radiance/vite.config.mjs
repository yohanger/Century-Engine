import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 4178 },
  build: {
    target: 'es2022',
    outDir: 'build/playground',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        playground: fileURLToPath(new URL('./examples/playground/index.html', import.meta.url)),
        webglQa: fileURLToPath(new URL('./tests/browser/index.html', import.meta.url)),
      },
    },
  },
});
