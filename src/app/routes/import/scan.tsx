import { createFileRoute } from '@tanstack/react-router';
import { Placeholder } from '@/shared/ui/Placeholder';

export const Route = createFileRoute('/import/scan')({
  component: () => <Placeholder title="掃描結果" screens="Import-And-Archive--2" />,
});
