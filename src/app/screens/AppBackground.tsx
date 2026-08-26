import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { BackgroundCanvas, fetchBackgrounds, useBackgroundOverride } from '@/features/backgrounds';
import { useBackdrop } from '@/shared/lib/backdropStore';

/**
 * **全站的背景圖，掛在 `__root` 只有一份**
 * （Peter 2026-08-26：「st 的背景全域是指全站背景，我們也應當如此」）。
 *
 * 🔴 **在此之前只有對話頁有背景** —— 那是我做窄了：ST 的 `#bg1` 就掛在
 * `public/index.html:53`，整個 app 共用一張。掛在各畫面的話換頁會閃一下，
 * 而且好友列表、設定頁都不會有。
 *
 * 兩層合成在這裡做（與後端同一條規則）：
 *   **對話層覆蓋**（`useBackgroundOverride`，由對話頁設定）**蓋過全域**（`settings.json`）。
 *
 * 🔴 順便把「現在有沒有背景」寫進 `useBackdrop` —— `Screen` 讀它決定要不要讓開。
 * **寫入者只有這裡一個**，理由見 `backdropStore.ts`。
 */
export function AppBackground() {
  const bg = useQuery({ queryKey: ['backgrounds'], queryFn: fetchBackgrounds });
  const override = useBackgroundOverride((s) => s.name);
  const setActive = useBackdrop((s) => s.setActive);

  const name = override ?? bg.data?.global.name;
  const fitting = bg.data?.global.fitting ?? 'classic';

  // 🔴 render 期間不可以改別人的 store（會在同一輪觸發別的元件重繪）⇒ 放進 effect。
  useEffect(() => setActive(Boolean(name)), [name, setActive]);

  return <BackgroundCanvas name={name} fitting={fitting} />;
}
