import { createRootRoute, Outlet } from '@tanstack/react-router';
import { ToastStack } from '@/shared/ui/ToastStack';

export const Route = createRootRoute({
  component: RootLayout,
});

/**
 * 🔴 **tips 堆疊掛在這裡，全站只有一份**（Peter 2026-08-26 要求 tips 要能堆疊）。
 * 掛在各畫面的話，換頁時還沒消失的 tips 會跟著卸載，而且兩個畫面同時掛就會互相遮擋。
 */
function RootLayout() {
  return (
    <>
      <Outlet />
      <ToastStack />
    </>
  );
}
