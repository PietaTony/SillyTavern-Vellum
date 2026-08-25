import { fileURLToPath } from 'node:url';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 後端是 ST 原本的 Express（M1 搬過來），跑在 8000。
// dev 時前端 5173，/api 與其他後端路由 proxy 過去。
const BACKEND = 'http://localhost:8000';

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      routesDirectory: './src/app/routes',
      generatedRouteTree: './src/app/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    react(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/csrf-token': { target: BACKEND, changeOrigin: true },
      '/thumbnail': { target: BACKEND, changeOrigin: true },
      '/characters': { target: BACKEND, changeOrigin: true },
      '/User': { target: BACKEND, changeOrigin: true },
    },
  },
});
