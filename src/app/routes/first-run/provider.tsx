import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { PROVIDERS, ProviderCard, useProviderChoice } from '@/features/providers';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/first-run/provider')({ component: ProviderPage });

/** 首次啟動第一步。沒有返回鍵：退無可退（`GAP-25` 三個真實入口之一）。 */
function ProviderPage() {
  const nav = useNavigate();
  const { selected, select } = useProviderChoice();

  return (
    <Screen
      title="選擇供應商"
      action={
        <Button
          size="small"
          disabled={!selected}
          onClick={() => void nav({ to: '/first-run/key' })}
        >
          下一步
        </Button>
      }
    >
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Vellum 只接兩家官方 API。兩家都可以，但取得方式差很多——先講清楚，別讓你選完才撞牆。
        </Typography>
        {PROVIDERS.map((p) => (
          <ProviderCard
            key={p.id}
            info={p}
            selected={selected === p.id}
            onToggle={() => select(p.id)}
          />
        ))}
      </Stack>
    </Screen>
  );
}
