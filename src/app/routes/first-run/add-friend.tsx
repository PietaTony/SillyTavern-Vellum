import { createFileRoute } from '@tanstack/react-router';
import { Placeholder } from '@/shared/ui/Placeholder';

export const Route = createFileRoute('/first-run/add-friend')({
  component: () => (
    <Placeholder title="加入好友" screens="First-Run--4 / --6 / --7（三狀態一份版面）" />
  ),
});
