/**
 * 抽出自 `model.ts`（A1 2026-08-31：加了插入位置的「尚未接線」說明後撞到 150 行上限）。
 * 純函式，一樣**不碰 api／store／ui**（A4，由 gate:boundaries 守）。
 */
import { GLOBAL_OWNER, IMPORTED_OWNER } from './types';

/**
 * 🔴 **三種擁有者，說明文字完全不同 —— 不可以共用一句**（`$worldId/index.tsx` 的教訓）。
 * 全域書：開著的條目套用到「所有」對話。匯入的書：`characterId` 永遠是
 * `IMPORTED_OWNER`，**不會因為綁了 persona 而改變**（綁定關係存在 persona 那邊，
 * 不是這本書自己）——所以「有沒有生效」不能只看 `characterId`，
 * 要另外帶 `boundCount`（誰在用它，來自 `/api/worlds` 的 `usedBy`）。
 * 沒有這個參數的話，剛匯入還沒人用的書、跟已經綁給某個 persona 在生效中的書，
 * 會顯示成同一句話 —— 後者那句就是謊言（2026-08-31 實機測試抓到）。
 * 好友的副本：只影響那一位好友。
 */
export function worldOwnerNote(
  characterId: string,
  boundCount = 0,
): { title: string; note: string } {
  if (characterId === GLOBAL_OWNER) {
    return {
      title: '全域世界書',
      note: '🔴 這是全域世界書 —— 開著的條目會套用到你「所有」的對話，不是只有某一位好友。',
    };
  }
  if (characterId === IMPORTED_OWNER) {
    return boundCount > 0
      ? {
          title: '世界書',
          note: '這本書是匯入的，已經綁定 —— 開著的條目會套用到綁到它的那一層。',
        }
      : {
          title: '世界書',
          note: '這本書是匯入的，還沒綁到任何一層 —— 目前不會套用到任何對話，先在「我自己」或「世界書」把它綁上去才會生效。',
        };
  }
  return {
    title: '世界書',
    note: '改動只影響這一位好友，不會動到卡片本身，也不會影響用同一張卡的其他好友。',
  };
}
