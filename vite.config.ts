import { fileURLToPath } from 'node:url';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 後端是 ST 原本的 Express（M1 搬過來），跑在 8000。
// dev 時前端 5173，/api 與其他後端路由 proxy 過去。
// 🔴 **dev 用 18520／18521，正式版用 8520**（Peter 2026-08-27 裁定）。
// 在此之前 dev 前端也是 8520 —— 而**桌面版寫死要綁 8520** ⇒ 兩邊互撞：
// 桌面版綁不上、例外沒人接就死掉，而它的視窗載入的是 dev server 的畫面
// （看起來成功了，點幾頁才閃退）。**兩個 bug 互相掩護。**
// ⚠️ 正式版那個 8520 不要跟著改 —— 那是使用者要打開的網址。
// 不這樣的話 dev 是 5173、正式版是 8520，
// 手機上還要記兩個。
// 🔴 可覆寫**只是為了開第二組隔離環境**（拿臨時 `VELLUM_DATA` 比對 first-run 與設定頁的版面）。
const BACKEND = process.env['VELLUM_BACKEND'] ?? 'http://localhost:18521';
const PORT = Number(process.env['VELLUM_PORT'] ?? 18520);

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
    port: PORT,
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
