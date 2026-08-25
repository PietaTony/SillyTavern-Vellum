import { createFileRoute } from '@tanstack/react-router';
import { Placeholder } from '@/shared/ui/Placeholder';

export const Route = createFileRoute('/import/drop')({
  component: () => <Placeholder title="拖入角色卡 PNG" screens="Settings-Theme-Import--8" />,
});
