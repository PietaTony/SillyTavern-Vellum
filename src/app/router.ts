import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { AppUnreachable } from './screens/AppUnreachable';

export const router = createRouter({
  routeTree,
  /**
   * 🔴 **整頁打不開時要說人話，而且只掛這一處。**
   * 少了它，`beforeLoad` 一丟例外（後端沒在跑 ⇒ vite 轉不過去 ⇒ `HTTP 502`）
   * 使用者看到的是 TanStack Router 的預設元件：一句英文的 `Something went wrong!`
   * 加一個紅框裡的 `HTTP 502` —— 沒說發生什麼事，也**沒有出口**
   *（Peter 2026-08-27 用手機透過 Tailscale 連進來時看到的）。
   * ⚠️ 掛在 router 的 `defaultErrorComponent` 而不是每支 route 各自掛：
   * 「要記得的東西一定會漏」，新 route 天生就該被接住。
   */
  defaultErrorComponent: AppUnreachable,
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
