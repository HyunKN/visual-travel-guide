import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: '../docs/prototype/content',
  build: { rollupOptions: { input: { app: 'index.html', materials: 'materials.html' } } },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
