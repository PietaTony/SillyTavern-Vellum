import { useState } from 'react';
import { FullScreenLayer } from '@/shared/ui/FullScreenLayer';
import { ProviderDetailPane, ProviderStatusChip, useProviderRow } from './ProviderDetailPane';
import { ProviderListPane } from './ProviderListPane';

/**
 * 供應商設定的**全螢層**：從對話頁 ☰ 原地打開，關掉回到對話原位
 * （Peter 2026-08-26：「這個選項顯示跟 /settings 完全相同」＋「原地開全螢層」）。
 *
 * 🔴 **內容與 `/settings/providers` 是同一份 code**，不是照著做一個像的
 * —— 兩個入口共用 `ProviderListPane`／`ProviderDetailPane`。
 *
 * 🔴 **層內的「清單 ↔ 單一供應商」用 local state，不是路由。**
 * 這一層刻意不碰網址：使用者還在那段對話裡，換 URL 等於把他帶走，
 * 而且瀏覽器上一頁會變成「回到清單」而不是「回到對話」。
 */
export function ProvidersLayer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { row } = useProviderRow(openId ?? '');

  // 🔴 關掉時退回第一級 —— 下次打開一定從清單開始，不會停在上次點進去的那一家。
  const close = () => {
    setOpenId(null);
    onClose();
  };

  if (openId)
    return (
      <FullScreenLayer
        open={open}
        title={row?.displayName ?? '供應商'}
        onClose={close}
        onBack={() => setOpenId(null)}
        action={<ProviderStatusChip p={row} />}
      >
        <ProviderDetailPane id={openId} onBack={() => setOpenId(null)} />
      </FullScreenLayer>
    );

  return (
    <FullScreenLayer open={open} title="AI 供應商與金鑰" onClose={close}>
      <ProviderListPane onOpen={setOpenId} />
    </FullScreenLayer>
  );
}
