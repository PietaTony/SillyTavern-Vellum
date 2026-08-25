import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { isSetUp } from '@/app/setup';

/**
 * 首次啟動流程的守衛（版面層，蓋住 `/first-run/*` 全部）。
 *
 * 🔴 **只要有一家供應商的金鑰設定好了，就再也進不來**（Peter 2026-08-25）——
 * 退回聊天清單。這不只是體感問題：首次流程假設「什麼都還沒有」，
 * 設定完之後再走一次會讓人以為要重設。
 *
 * ⚠️ 這條守衛與流程本身會打架的地方：金鑰是在**測試通過的當下**存下來的，
 * 所以走到「下一步 → 加入好友」時使用者**已經算設定完成**了。
 * ⇒ `first-run/key` 通過之後是導到 `/add-friend`（設定完成後的那個入口），
 * 不是 `/first-run/add-friend`，否則會被這條守衛擋下來。
 */
export const Route = createFileRoute('/first-run')({
  beforeLoad: async () => {
    if (await isSetUp()) throw redirect({ to: '/chat-list' });
  },
  component: Outlet,
});
