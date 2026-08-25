import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { KeyGate, providerById, useProviderChoice } from '@/features/providers';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/first-run/key')({ component: KeyPage });

function KeyPage() {
  const nav = useNavigate();
  const selected = useProviderChoice((s) => s.selected);
  // 返回落點來自設計正本 back.json：First-Run--3 → First-Run--1
  const back = () => nav({ to: '/first-run/provider' });

  // M3「永遠引導」：沒有選過供應商就直接進來 → 給出口，不是給死路
  if (!selected) {
    return (
      <Screen title="取得金鑰" onBack={back}>
        <ErrorState
          title="還沒選供應商"
          detail="要先知道你用哪一家，才知道該教你去哪裡拿金鑰。"
          action={{ label: '回去選供應商', onAct: back }}
        />
      </Screen>
    );
  }

  return (
    <KeyGate
      info={providerById(selected)}
      onBack={back}
      onPassed={() => nav({ to: '/first-run/add-friend' })}
    />
  );
}
