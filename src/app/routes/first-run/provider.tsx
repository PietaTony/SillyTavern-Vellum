import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { PROVIDERS, ProviderCard, useProviderChoice } from '@/features/providers';
import { Button } from '@/shared/ui/Button';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/first-run/provider')({ component: ProviderPage });

function ProviderPage() {
  const nav = useNavigate();
  const { selected, select } = useProviderChoice();

  return (
    <Screen
      title="選擇供應商"
      lede="Vellum 只接兩家官方 API。兩家都可以，但取得方式差很多——先講清楚，別讓你選完才撞牆。"
      footer={
        <Button disabled={!selected} onClick={() => nav({ to: '/first-run/key' })}>
          下一步 → 取得金鑰
        </Button>
      }
    >
      {PROVIDERS.map((p) => (
        <ProviderCard
          key={p.id}
          info={p}
          selected={selected === p.id}
          onToggle={() => select(selected === p.id ? p.id : p.id)}
        />
      ))}
    </Screen>
  );
}
