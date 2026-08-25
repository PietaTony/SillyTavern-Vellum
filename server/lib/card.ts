/**
 * Chara Card（TavernCard）解析。**這是「別人的卡能不能匯進來」的入口。**
 *
 * 🔴 **最高契約：無資訊遺失**（規格 §7 A1／A2）。判準是「無資訊遺失」，**不是位元組相等**——
 * PNG 重新編碼、鍵序不同都可以，**但一個欄位都不准掉**。
 *
 * 🔴 **兩份 payload 都要留。** 卡片同時帶 `chara`（v2 相容）與 `ccv3`（v3 正本），
 * 兩者內容**不保證相同**（實測標的卡兩者長度差 1 byte）。
 * 只留一份再從它產生另一份 ＝ 靜默改寫別人的卡。⇒ 各自原樣保存、各自寫回。
 */
import { readChunks, replaceText, textOf, writeChunks, type Chunk } from './png.ts';

export const CARD_KEYWORDS = ['ccv3', 'chara'] as const;
export type CardKeyword = (typeof CARD_KEYWORDS)[number];

/** 每個 keyword 各自的原始 JSON。`primary` 是我們讀欄位時該看哪一份。 */
export type Card = {
  payloads: Partial<Record<CardKeyword, unknown>>;
  primary: CardKeyword;
};

export class NotACard extends Error {
  constructor(why: string) {
    super(why);
    this.name = 'NotACard';
  }
}

/**
 * `tEXt` 的 text 段解成 JSON。
 *
 * 角色卡的慣例是 **base64(UTF-8 JSON)**，但野生的卡有直接塞 JSON 的。
 * 🔴 兩種都試，**但不要靜默失敗**——兩種都不成就丟例外，讓匯入當場失敗，
 * 而不是回一張空白角色卡（那會看起來像「這張卡本來就沒內容」）。
 */
export function decodePayload(text: string): unknown {
  // 🔴 `text` 是用 latin1 讀出來的（`tEXt` 規格如此）。直接塞 UTF-8 JSON 的野生卡
  // 用 latin1 讀會變成一串壞字 —— 所以第二種解法要**先還原成 byte 再用 utf8 解**，
  // 不能直接 `JSON.parse(text)`（那樣中文會全毀，而且是靜默的）。
  const tries = [
    () => JSON.parse(Buffer.from(text, 'base64').toString('utf8')) as unknown,
    () => JSON.parse(Buffer.from(text, 'latin1').toString('utf8')) as unknown,
  ];
  for (const t of tries) {
    try {
      const v = t();
      if (v && typeof v === 'object') return v;
    } catch {
      // 換下一種解法
    }
  }
  throw new NotACard('tEXt 內容既不是 base64 JSON 也不是 JSON');
}

export function encodePayload(json: unknown): string {
  return Buffer.from(JSON.stringify(json), 'utf8').toString('base64');
}

/** 從 PNG 讀出卡片。兩個 keyword 都不在就不是角色卡。 */
export function readCard(png: Buffer): Card {
  const chunks = readChunks(png);
  const payloads: Partial<Record<CardKeyword, unknown>> = {};
  for (const kw of CARD_KEYWORDS) {
    const text = textOf(chunks, kw);
    if (text !== null) payloads[kw] = decodePayload(text);
  }
  const primary = CARD_KEYWORDS.find((kw) => payloads[kw] !== undefined);
  if (!primary) throw new NotACard('這張 PNG 沒有角色卡資料（找不到 ccv3／chara）');
  return { payloads, primary };
}

/** 把卡片寫回 PNG：每個 keyword 寫回自己的那份，其餘 chunk 一個都不動。 */
export function embedCard(png: Buffer, card: Card): Buffer {
  let chunks: Chunk[] = readChunks(png);
  for (const kw of CARD_KEYWORDS) {
    const payload = card.payloads[kw];
    if (payload !== undefined) chunks = replaceText(chunks, kw, encodePayload(payload));
  }
  return writeChunks(chunks);
}

type Bag = Record<string, unknown>;
const bag = (v: unknown): Bag => (v && typeof v === 'object' ? (v as Bag) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * 讀我們現在用得到的四個欄位。
 *
 * 🔴 **這是「讀取視圖」，不是資料模型。** V2 把欄位放在 top-level，V3 放在 `data` 底下；
 * 兩種都要讀得到。**正本永遠是 `payloads` 裡那份原始 JSON**，這裡只是投影出去給 UI 用。
 * ⚠️ 不要反過來拿這四個欄位去重建卡片——那會丟掉其餘幾十個欄位。
 */
export function viewOf(card: Card): {
  name: string;
  description: string;
  firstMessage: string;
  alternateGreetings: string[];
} {
  const root = bag(card.payloads[card.primary]);
  const data = bag(root['data']);
  const pick = (k: string): string => str(data[k] !== undefined ? data[k] : root[k]);
  const alts = data['alternate_greetings'] ?? root['alternate_greetings'];
  return {
    name: pick('name'),
    description: pick('description'),
    firstMessage: pick('first_mes'),
    alternateGreetings: Array.isArray(alts) ? alts.filter((a): a is string => typeof a === 'string') : [],
  };
}
