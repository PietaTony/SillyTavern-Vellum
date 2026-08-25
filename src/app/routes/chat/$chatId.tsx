import { createFileRoute } from '@tanstack/react-router';
import { Placeholder } from '@/shared/ui/Placeholder';

export const Route = createFileRoute('/chat/$chatId')({
  component: () => (
    <Placeholder title="對話串" screens="Chat-Thread-Layout--5 / Waiting-And-Thinking--1" />
  ),
});
