/**
 * PNG chunk 讀寫。**角色卡就是一張 PNG，卡片資料塞在 `tEXt` chunk 裡。**
 *
 * 🔴 **這一層存在的唯一理由是「無資訊遺失」**（規格 §7 A1）。
 * 所以它的契約是：**除了我們指名要換掉的 `tEXt`，其他 chunk 原樣進、原樣出**——
 * 包含 IDAT、以及任何我們不認得的私有 chunk。**不認得就不要碰，更不要丟掉。**
 *
 * 不用第三方 PNG 套件：我們只需要 chunk 層，不需要解碼像素。
 * 引一個解碼器進來反而會在重新編碼時改變 IDAT，違反上面那條契約。
 */

/** PNG 檔頭固定這 8 個 byte。不是這串就不是 PNG。 */
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type Chunk = { type: string; data: Buffer };

/** 這不是 PNG，或 chunk 結構壞掉。route 層要轉成 400，不是 500。 */
export class NotAPng extends Error {
  constructor(why: string) {
    super(why);
    this.name = 'NotAPng';
  }
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

/** PNG 用的 CRC-32（多項式 0xEDB88320）。寫回時每個 chunk 都要重算。 */
export function crc32(buf: Buffer): number {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/**
 * 把 PNG 拆成 chunk 陣列，順序保留。
 *
 * 🔴 **刻意不驗 CRC。** 理由：野生的角色卡經過各種工具轉手，CRC 壞掉的所在多有；
 * 為了一個我們不使用的欄位而拒絕匯入別人的卡，代價遠大於收益。
 * 我們寫回時一律重算，所以壞 CRC 進來也會被修好。
 */
export function readChunks(png: Buffer): Chunk[] {
  if (png.length < 8 || !png.subarray(0, 8).equals(SIGNATURE)) throw new NotAPng('不是 PNG 檔');
  const out: Chunk[] = [];
  let at = 8;
  let sawIend = false;
  while (at + 8 <= png.length) {
    const len = png.readUInt32BE(at);
    const type = png.toString('latin1', at + 4, at + 8);
    const end = at + 12 + len;
    if (end > png.length) throw new NotAPng(`chunk ${type} 的長度超出檔案`);
    out.push({ type, data: png.subarray(at + 8, at + 8 + len) });
    at = end;
    if (type === 'IEND') {
      sawIend = true;
      break;
    }
  }
  if (!out.some((c) => c.type === 'IHDR')) throw new NotAPng('缺少 IHDR');
  // 🔴 **截斷的檔一定要擋下來。** 少了這一條，檔案尾巴被切掉時我們會安靜地回傳
  // 前半段的 chunk —— 而角色卡的 `chara`／`ccv3` 常常就排在後面。
  // 那會變成「匯入成功，但卡片內容不見了」，是最糟的一種失敗。
  if (!sawIend) throw new NotAPng('檔案在 IEND 之前就結束了（檔案不完整）');
  return out;
}

/** chunk 陣列組回 PNG。CRC 一律重算——進來時壞的，出去是好的。 */
export function writeChunks(chunks: Chunk[]): Buffer {
  const parts: Buffer[] = [SIGNATURE];
  for (const { type, data } of chunks) {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length, 0);
    const typed = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc32(typed), 0);
    parts.push(head, typed, tail);
  }
  return Buffer.concat(parts);
}

/**
 * `tEXt` 的內容是 `keyword \0 text`，兩段都是 latin1。
 * 🔴 **不要用 utf8 解**——keyword 規格上限定 latin1，而 text 段在角色卡裡是 base64，
 * 用 utf8 解會在遇到 0x80-0xFF 時靜靜壞掉。
 */
export function splitText(data: Buffer): { keyword: string; text: string } | null {
  const nul = data.indexOf(0);
  if (nul <= 0) return null;
  return { keyword: data.toString('latin1', 0, nul), text: data.toString('latin1', nul + 1) };
}

export function makeText(keyword: string, text: string): Chunk {
  return {
    type: 'tEXt',
    data: Buffer.concat([Buffer.from(keyword, 'latin1'), Buffer.from([0]), Buffer.from(text, 'latin1')]),
  };
}

/** 取出某個 keyword 的 `tEXt` 內容（原文，不解 base64）。沒有就 null。 */
export function textOf(chunks: Chunk[], keyword: string): string | null {
  for (const c of chunks) {
    if (c.type !== 'tEXt') continue;
    const kv = splitText(c.data);
    if (kv?.keyword === keyword) return kv.text;
  }
  return null;
}

/**
 * 換掉（或新增）某個 keyword 的 `tEXt`，**其餘 chunk 一個都不動**。
 * 新增時插在 IEND 之前——IEND 必須是最後一個 chunk。
 */
export function replaceText(chunks: Chunk[], keyword: string, text: string): Chunk[] {
  const next = makeText(keyword, text);
  let replaced = false;
  const out = chunks.map((c) => {
    if (c.type !== 'tEXt' || replaced) return c;
    if (splitText(c.data)?.keyword !== keyword) return c;
    replaced = true;
    return next;
  });
  if (replaced) return out;
  const iend = out.findIndex((c) => c.type === 'IEND');
  if (iend < 0) return [...out, next];
  return [...out.slice(0, iend), next, ...out.slice(iend)];
}
