/**
 * 從卡片裡把內嵌的圖片資產抽出來。
 *
 * 🔴 **規格 P7 硬約束 3：貼圖不以 base64 留在角色卡欄位裡。**
 * 這張卡把 **199 萬字元**的 WebP 塞在一支腳本的字串中間（整支腳本 96.4% 的體積是它），
 * 留著的話每次讀卡都要解析那 2 MB 字串。
 *
 * ⚠️ **抽出來 ≠ 從卡裡刪掉。** 卡內原欄位依 A1 原樣保留，我們只是另外存一份可用的資產。
 * 刪掉原欄位就是資料損毀 —— 那張卡回到 ST 上還要靠它。
 *
 * 🔴 **用正則找，不解析 JS、更不執行它。** 我們的整條線上不存在動態 code 執行（閘門 `gate:no-eval`）。
 */

export type FoundSprite = { mime: string; base64: string; bytes: number; at: string };

const DATA_URL = /data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]{500,})/g;

/** 一段文字裡的所有內嵌圖片。門檻 500 字元，避免把小圖示也算進來。 */
export function findSprites(text: string, at: string): FoundSprite[] {
  const out: FoundSprite[] = [];
  for (const m of text.matchAll(DATA_URL)) {
    const base64 = m[2] ?? '';
    out.push({ mime: m[1] ?? 'image/unknown', base64, bytes: Math.floor((base64.length * 3) / 4), at });
  }
  return out;
}

type Bag = Record<string, unknown>;
const bag = (v: unknown): Bag => (v && typeof v === 'object' ? (v as Bag) : {});

/** 走一遍卡片的擴充欄位找資產。回報**在哪找到的**——來源不明的資產不要用。 */
export function spritesInCard(cardJson: unknown): FoundSprite[] {
  const ext = bag(bag(bag(cardJson)['data'])['extensions']);
  const out: FoundSprite[] = [];
  const scripts = bag(ext['tavern_helper'])['scripts'];
  if (Array.isArray(scripts)) {
    for (const [i, raw] of scripts.entries()) {
      const content = bag(raw)['content'];
      if (typeof content === 'string') out.push(...findSprites(content, `tavern_helper.scripts[${i}]`));
    }
  }
  return out;
}

export const spriteExt = (mime: string): string => (mime.split('/')[1] ?? 'bin').replace('+xml', '');

/** base64 → bytes。**壞掉的 base64 要丟例外**，不要存出一個打不開的檔。 */
export function spriteBytes(s: FoundSprite): Buffer {
  const buf = Buffer.from(s.base64, 'base64');
  if (buf.length === 0) throw new Error(`${s.at} 的 base64 解不出內容`);
  return buf;
}
