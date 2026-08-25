import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { PROVIDERS, ProviderCard, useProviderChoice } from '@/features/providers';
import { Button } from '@/shared/ui/Button';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/first-run/provider')({ component: ProviderPage });

/**
 * `First-Run--1`。🔴 **「下一步」在 topbar 右側**（`v-btn--ghost`），不是 footer ——
 * 這張與 `First-Run--3` 的版面刻意不同，照設計正本抄。
 * 沒有返回鍵：首次啟動第一步，退無可退（`GAP-25` 三個真實入口之一）。
 */
function ProviderPage() {
  const nav = useNavigate();
  const { selected, select } = useProviderChoice();

  return (
    <Screen
      title="選擇供應商"
      action={
        <Button variant="ghost" disabled={!selected} onClick={() => nav({ to: '/first-run/key' })}>
          下一步
        </Button>
      }
    >
      <div className="v-hint">
        Vellum 只接兩家官方 API。兩家都可以，但取得方式差很多——先講清楚，別讓你選完才撞牆。
      </div>
      {PROVIDERS.map((p) => (
        <ProviderCard
          key={p.id}
          info={p}
          selected={selected === p.id}
          onToggle={() => select(p.id)}
        />
      ))}
    </Screen>
  );
}
