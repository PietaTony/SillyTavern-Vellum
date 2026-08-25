import { createFileRoute } from '@tanstack/react-router';
import { Placeholder } from '@/shared/ui/Placeholder';

export const Route = createFileRoute('/first-run/key')({
  component: () => (
    <Placeholder
      title="取得 Claude 金鑰"
      screens="First-Run--3 / --3a / --3b / --3c（四狀態一份版面·測試閘門）"
    />
  ),
});
