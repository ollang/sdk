import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5972', // TMS server default port (POST /api/strapi-schema, etc.)
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../ui-dist',
    emptyOutDir: true,
  },
});
