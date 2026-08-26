import { useEffect } from 'react';
import { useBackgroundOverride } from '@/features/backgrounds';

/**
 * 讓**這一間自己的背景蓋過全站那張**。
 *
 * 圖本身畫在 `__root`（全站一張，Peter 2026-08-26：「st 的背景全域是指全站背景，
 * 我們也應當如此」）⇒ 對話頁不自己畫，只負責告訴它「換成這張」。
 *
 * 🔴 **cleanup 一定要清掉。** 不清的話走出對話之後，好友列表與設定頁
 * 會繼續套著那一間的背景 —— 而使用者完全看不出來是哪一步造成的。
 * ⚠️ 呼叫端要把它放在**所有早退之前**（`q.isPending` 那幾個），
 * 否則 render 之間 hook 數量會變。
 */
export function useChatBackgroundOverride(name: string | undefined): void {
  const setOverride = useBackgroundOverride((s) => s.setName);
  useEffect(() => {
    setOverride(name);
    return () => setOverride(undefined);
  }, [name, setOverride]);
}
