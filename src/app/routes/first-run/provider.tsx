import Stack from '@mui/material/Stack';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AlphaNotice } from '@/features/about';
import { ProviderListPane } from '@/features/providers';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/first-run/provider')({ component: ProviderPage });

/**
 * 首次啟動第一步。沒有返回鍵：退無可退（`GAP-25` 三個真實入口之一）。
 *
 * 🔴 **內容與 `/settings/providers` 是同一份 code**（Peter 2026-08-27）——
 * 共用 `ProviderListPane`，不是照著做一個像的。
 *
 * 🔴 **舊版的兩張大卡片（`ProviderCard` ＋ `model.ts` 的 `PROVIDERS`）已經刪掉。**
 * 那一版只列 Google 與 Anthropic 兩家，而後端 registry 有 26 家 ——
 * 前端自己維護第二份名單的下場就是「first-run 說只有兩家、設定頁說有 26 家」，
 * 而使用者會以為是自己哪裡沒設定好。名單的正本只有後端那一份。
 *
 * 🔴 **這一頁不再有「下一步」**。舊版是「選一家 → 下一步 → 貼金鑰」，
 * 選取只是個記在記憶體裡的旗標；現在點進哪一家就設定哪一家，
 * 「選了什麼」與「設定了什麼」不再是兩件會不同步的事。
 *
 * ⚠️ `design/screens.json` 說這一頁 `back: null` ⇒ **這支檔案裡不可以出現 `onBack`**
 * （`gate:back` 反向檢查）。所以點進某一家要跳 `/first-run/key`，
 * 不能像對話頁 ☰ 的全螢層那樣用 local state 就地展開。
 */
function ProviderPage() {
  const nav = useNavigate();

  return (
    <Screen title="選擇供應商">
      <Stack spacing={2}>
        {/* 🔴 擺在第一頁最上面：他還在決定要不要投入的那一刻，不是裝完之後才說。 */}
        <AlphaNotice />
        <ProviderListPane onOpen={(id) => void nav({ to: '/first-run/key', search: { id } })} />
      </Stack>
    </Screen>
  );
}
