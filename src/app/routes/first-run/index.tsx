import { createFileRoute, redirect } from '@tanstack/react-router';

/** `/first-run` 自己沒有畫面 —— 導到第一步，不要留一個空白的死路。 */
export const Route = createFileRoute('/first-run/')({
  beforeLoad: () => {
    throw redirect({ to: '/first-run/provider' });
  },
});
