import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ProviderDetailPane, ProviderStatusChip, useProviderRow } from '@/features/providers';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/settings/providers/$id')({ component: ProviderPage });

/**
 * 單一供應商的設定頁（Peter 2026-08-26 實測後要求）—— **設定分頁的入口**。
 *
 * 🔴 **這一頁只剩外殼。** 內容在 `features/providers/ui/ProviderDetailPane.tsx`，
 * 與對話頁 ☰ 全螢層共用同一份。26 家都點得進來（含 `planned` 四家）的理由寫在那支檔頭。
 */
function ProviderPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const back = () => void nav({ to: '/settings/providers' });
  const { row } = useProviderRow(id);

  return (
    <Screen
      title={row?.displayName ?? '供應商'}
      onBack={back}
      action={<ProviderStatusChip p={row} />}
    >
      <ProviderDetailPane id={id} onBack={back} />
    </Screen>
  );
}
