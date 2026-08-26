import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ProviderListPane } from '@/features/providers';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/settings/providers/')({ component: ProvidersPage });

/**
 * AI 供應商與模型（派工⑤ 優先序 2）—— **設定分頁的入口**。
 *
 * 🔴 **這一頁只剩外殼。** 內容全搬到 `features/providers/ui/ProviderListPane.tsx`，
 * 因為對話頁 ☰ 的全螢層要顯示**完全相同**的東西（Peter 2026-08-26）。
 * 留在這裡就會被複製成兩份，然後其中一份慢慢長歪。
 * 🔴 26 家全列、radio ＝「對話現在打誰」、切換與驗證分兩段 —— 這些判準的原文都在那支檔頭。
 */
function ProvidersPage() {
  const nav = useNavigate();

  return (
    <Screen title="AI 供應商與金鑰" onBack={() => void nav({ to: '/settings' })}>
      <ProviderListPane
        onOpen={(id) => void nav({ to: '/settings/providers/$id', params: { id } })}
      />
    </Screen>
  );
}
