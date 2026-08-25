/**
 * B5 · 開場白 metadata 提取器（產品內建行為，不開放卡片自訂語法）。
 *
 * 卡片把「這個開場白要開哪些世界書條目」寫成 **HTML 註解**藏在訊息文字裡：
 *   `<!-- lore: 12,13 -->` `<!-- exclude: 7 -->`
 * 每個 swipe 各自帶自己的一組。
 *
 * 🔴 **沒有這支，P4 的來源 1 永遠不會觸發**，21 條預設關閉的條目會永遠沉睡
 * （規格 §6 B5、複檢 F5）。
 *
 * 🔴 **提取不等於顯示。** 這些註解是給引擎看的，顯示端本來就看不到（HTML 註解），
 * 但**送回 prompt 的版本要拿掉**——否則模型會看到一串 uid 數字。
 */

export type LoreTags = { include: string[]; exclude: string[] };

const collect = (text: string, label: string): string[] => {
  const out: string[] = [];
  const re = new RegExp(`<!--\\s*${label}\\s*[:：]\\s*([^>]*?)\\s*-->`, 'gi');
  for (const m of text.matchAll(re)) {
    for (const part of (m[1] ?? '').split(/[,，\s]+/)) {
      const uid = part.trim();
      if (uid) out.push(uid);
    }
  }
  return out;
};

/** 從一則訊息（單一 swipe）的文字裡取出標籤。沒有就兩個空陣列。 */
export function extractLoreTags(text: string): LoreTags {
  return { include: collect(text, 'lore'), exclude: collect(text, 'exclude') };
}

/** 把標籤從文字裡拿掉（送 prompt 前用）。 */
export const stripLoreTags = (text: string): string =>
  text.replace(/<!--\s*(?:lore|exclude)\s*[:：][^>]*?-->\s*/gi, '');

/** 有沒有任何標籤 —— 用來判斷「這張卡有沒有在用這個機制」。 */
export const hasLoreTags = (t: LoreTags): boolean => t.include.length > 0 || t.exclude.length > 0;
