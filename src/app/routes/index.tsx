import { createFileRoute, redirect } from '@tanstack/react-router';

// 首次啟動的進入點。之後要改成「有沒有設定過」的判斷（M2）。
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/first-run/provider' });
  },
});
