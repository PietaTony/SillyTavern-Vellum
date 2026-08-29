import { createRootRoute, Navigate, Outlet, redirect } from '@tanstack/react-router';
import { authState, needsLogin } from '@/app/auth';
import { AppBackground } from '@/app/screens/AppBackground';
import { isSetUp, needsFirstRun } from '@/app/setup';
import { LanWarning } from '@/features/network';
import { ToastStack } from '@/shared/ui/ToastStack';

export const Route = createRootRoute({
  /**
   * 🔴 **首次流程是必經的，而且守在「全站的入口」，不是每一支 route 各自守**
   * （Peter 2026-08-27：「沒跑過不能路由亂跑」）。
   *
   * 🔴 **存取密碼守衛排在 first-run 之前**（2026-08-29）：已設密碼時 API 要 session，
   * 若先跑 isSetUp() 會打到 `/api/secrets` 拿到 401，看起來像產品壞了。
   * `/login` 兩條都不跑 —— 登入頁自己處理「已登入就離開」。
   */
  beforeLoad: async ({ location }) => {
    const path = location.pathname;
    if (path.startsWith('/login')) return;

    const auth = await authState();
    if (needsLogin(path, auth)) {
      throw redirect({ to: '/login', search: { next: path } });
    }

    if (needsFirstRun(path, await isSetUp())) throw redirect({ to: '/first-run/provider' });
  },
  component: RootLayout,
  notFoundComponent: NotFound,
});

/**
 * 認不得的網址 → 聊天清單（Peter 2026-08-27：「跑過了 first run，則亂跑路由要回到 chat-list」）。
 *
 * 🔴 **`replace`**：不要在歷史裡留下那個不存在的網址，否則按上一頁又跳回來一次。
 * ⚠️ 還沒設定過的人根本走不到這裡 —— 上面的 `beforeLoad` 已經先把他導去首次流程了。
 * 兩條的先後順序是刻意的：**「還沒設定」比「網址打錯」重要**。
 */
function NotFound() {
  return <Navigate to="/chat-list" replace />;
}

/**
 * 🔴 **tips 堆疊掛在這裡，全站只有一份**（Peter 2026-08-26 要求 tips 要能堆疊）。
 * 掛在各畫面的話，換頁時還沒消失的 tips 會跟著卸載，而且兩個畫面同時掛就會互相遮擋。
 *
 * 🔴 **背景圖同理，也是全站一份**（Peter 2026-08-26：「st 的背景全域是指全站背景」）。
 * 它在 `Outlet` **前面** —— `BackgroundCanvas` 是 `z-index: -1` 的固定層，
 * 要墊在所有畫面底下，不是疊在上面。
 */
function RootLayout() {
  return (
    <>
      <AppBackground />
      {/*
       * 🔴 **走區網連進來的警告掛在這裡，全站一份**（Peter 2026-08-27）。
       * 掛在單一畫面的話，換頁就沒了 —— 而風險是整段使用期間都存在的。
       * 本機打開時它完全不掛（判準見 `hostKind`），所以絕大多數人不會看到它。
       */}
      <LanWarning />
      <Outlet />
      <ToastStack />
    </>
  );
}
