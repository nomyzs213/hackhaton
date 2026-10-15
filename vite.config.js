import { defineConfig } from 'vite';

export default defineConfig({
  base: '/hackhaton/',
  server: { port: 5173, open: true },
  build: { outDir: 'dist', sourcemap: true },
});