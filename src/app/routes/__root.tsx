import { createRootRoute, Outlet } from '@tanstack/react-router';
import { AppBackground } from '@/app/screens/AppBackground';
import { ToastStack } from '@/shared/ui/ToastStack';

export const Route = createRootRoute({
  component: RootLayout,
});

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
      <Outlet />
      <ToastStack />
    </>
  );
}
