import { createFileRoute, redirect } from '@tanstack/react-router';
import { isSetUp } from '@/app/setup';

/**
 * 首頁。**設定完成之後預設是聊天清單**（Peter 2026-08-25）。
 * 還沒設定過才進首次啟動流程。
 */
export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    throw redirect({ to: (await isSetUp()) ? '/chat-list' : '/first-run/provider' });
  },
});
