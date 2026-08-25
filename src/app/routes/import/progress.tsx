import { createFileRoute } from '@tanstack/react-router';
import { Placeholder } from '@/shared/ui/Placeholder';

export const Route = createFileRoute('/import/progress')({
  component: () => <Placeholder title="匯入中" screens="Import-And-Archive--3（刻意沒有返回鍵）" />,
});
