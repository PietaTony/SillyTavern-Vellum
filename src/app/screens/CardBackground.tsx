import { type CardScriptsView, ScriptFrame } from '@/features/cardscripts';

/**
 * 🔴 **桌寵那一層**（M13 第三期）。
 *
 * 卡片的背景腳本全部跑在**同一個** frame 裡（理由見 `useCardScripts.ts` 檔頭：
 * 它們靠共用全域協作，一支一個沙箱 frame 會讓它們互相看不見）。
 *
 * 那個 frame `position:fixed` 鋪滿視窗、**預設不吃點擊** —— 只有指標真的落在桌寵身上時
 * 才接管（命中測試在 `runtime/srcdoc.ts`）。不這樣做的話，一個鋪滿的 iframe
 * 會把底下整個 app 的點擊全部吃掉。
 *
 * 🔴 **沒同意 ＝ `background` 是 `null` ＝ 這個 frame 根本不存在**（不是「存在但不跑」）。
 */
export function CardBackground({
  cards,
  characterId,
}: {
  cards: CardScriptsView;
  characterId: string;
}) {
  if (!cards.background) return null;
  return (
    <ScriptFrame
      mode="overlay"
      preWrapped
      code={cards.background}
      allow={cards.allow}
      vars={cards.vars}
      name={`cardbg-${characterId}`}
    />
  );
}
