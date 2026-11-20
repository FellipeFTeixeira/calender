import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src',
  base: './',
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { outDir: '../dist', emptyOutDir: true, target: 'chrome120', chunkSizeWarningLimit: 800 },
});
