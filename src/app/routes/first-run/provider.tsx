import { createFileRoute } from '@tanstack/react-router';
import { Placeholder } from '@/shared/ui/Placeholder';

export const Route = createFileRoute('/first-run/provider')({
  component: () => <Placeholder title="選供應商" screens="First-Run--1" />,
});
