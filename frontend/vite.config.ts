import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
      // Com o proxy do socket, VITE_WS_URL pode ficar vazio também no dev.
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
  plugins: [react(), viteSingleFile()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
