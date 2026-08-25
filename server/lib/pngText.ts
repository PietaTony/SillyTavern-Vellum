/**
 * PNG 文字 chunk 的解碼。**三種都要讀**：
 *   `tEXt` 未壓縮｜`zTXt` zlib 壓縮｜`iTXt` 國際化（可壓縮）
 *
 * 🔴 只讀 `tEXt` 的話，用另外兩種寫入的卡片會被回報成「這張 PNG 沒有角色卡資料」——
 * **那是我們讀不到，不是它沒有。** 這種錯誤訊息會讓使用者以為是自己的檔案壞了。
 *
 * 🔴 **這支只吃 `type` 與 `data`，不吃 `Chunk` 型別** —— 型別住在 `png.ts`，
 * 從這裡 import 回去就是循環相依（`gate:boundaries` 會擋）。
 */
import { inflateSync } from 'node:zlib';

export type TextEntry = { keyword: string; text: string };

/** `tEXt`：`keyword \0 text`，兩段都是 latin1。 */
export function decodePlain(data: Buffer): TextEntry | null {
  const nul = data.indexOf(0);
  if (nul <= 0) return null;
  return { keyword: data.toString('latin1', 0, nul), text: data.toString('latin1', nul + 1) };
}

/** `zTXt`：`keyword \0 compressionMethod(1) compressedText`。 */
function decodeCompressed(data: Buffer): TextEntry | null {
  const nul = data.indexOf(0);
  if (nul <= 0 || data.length < nul + 2) return null;
  // 方法 0 是 zlib deflate，規格目前只定義這一種；其他的我們不猜。
  if (data[nul + 1] !== 0) return null;
  try {
    return { keyword: data.toString('latin1', 0, nul), text: inflateSync(data.subarray(nul + 2)).toString('latin1') };
  } catch {
    return null;
  }
}

/**
 * `iTXt`：`keyword \0 flag(1) method(1) lang \0 translatedKeyword \0 text`。
 * 🔴 規格上 text 是 UTF-8，但這裡一律回 latin1 讓上層統一處理
 * （`decodePayload` 會先試 base64、再試 latin1→utf8）——**兩條路只留一條**。
 */
function decodeIntl(data: Buffer): TextEntry | null {
  const nul = data.indexOf(0);
  if (nul <= 0 || data.length < nul + 3) return null;
  const compressed = data[nul + 1] === 1;
  const langEnd = data.indexOf(0, nul + 3);
  if (langEnd < 0) return null;
  const transEnd = data.indexOf(0, langEnd + 1);
  if (transEnd < 0) return null;
  const body = data.subarray(transEnd + 1);
  try {
    return {
      keyword: data.toString('latin1', 0, nul),
      text: (compressed ? inflateSync(body) : body).toString('latin1'),
    };
  } catch {
    return null;
  }
}

/** 依 chunk 型別解碼；不是文字 chunk 就 null。 */
export function decodeText(type: string, data: Buffer): TextEntry | null {
  if (type === 'tEXt') return decodePlain(data);
  if (type === 'zTXt') return decodeCompressed(data);
  if (type === 'iTXt') return decodeIntl(data);
  return null;
}
