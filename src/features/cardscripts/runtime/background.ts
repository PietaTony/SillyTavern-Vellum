import { wrap } from './srcdoc';

/**
 * 背景腳本組出 iframe 的 `<script>` 字串。**桌寵開關關掉（E1）或這張卡沒有背景腳本
 * 都回 `null`**——`null` 讓 `CardBackground.tsx` 的 `!cards.background` 直接不畫，
 * 跟「沒同意」走同一條「frame 根本不存在」的路，不是 CSS 藏起來還在跑。
 * 從 `useCardScripts.ts` 抽出來單純是為了把那支的行數讓給 E1 的新狀態變數。
 */
export function backgroundOf(
  scripts: { content: string }[] | undefined,
  companionEnabled: boolean,
): string | null {
  const list = companionEnabled ? (scripts ?? []) : [];
  return list.length > 0 ? list.map((x) => wrap(x.content)).join('') : null;
}
