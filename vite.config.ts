import { fileURLToPath } from 'node:url';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 後端是 ST 原本的 Express（M1 搬過來），跑在 8000。
// dev 時前端 5173，/api 與其他後端路由 proxy 過去。
const BACKEND = 'http://localhost:8787';

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
    // 🔴 綁所有介面，手機才連得到（預設只綁 localhost —— 這就是 Tailscale 開了也看不到的原因）。
    // 範圍＝tailnet 內的自己人：Mac／iPad／iPhone。
    host: true,
    // Vite 會擋掉 Host header 不認得的請求。開頭的點＝允許該網域底下所有主機。
    allowedHosts: ['.ts.net'],
    proxy: {
      // 後端**維持只綁本機**，由 Vite 從 Mac 這一端代理過去 ⇒ 後端不額外曝露到 tailnet。
      '/api': { target: BACKEND, changeOrigin: true },
    },
  },
});
