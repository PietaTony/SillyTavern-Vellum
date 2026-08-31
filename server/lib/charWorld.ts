/**
 * 每個好友**自己一份**的世界書副本（D-f）。
 *
 * 🔴 **為什麼要複製而不是共用**：D-e 允許同一張卡加入多次。
 * 共用同一本書的話，**在 A 那裡切「成年線」，B 也會跟著變** —— 狀態隔離不開。
 *
 * 🔴 **卡內那份永遠原樣保留、只讀不寫**（驗收 A1）。這裡是副本，改的是副本。
 *
 * 🔴 **`origin` 出廠快照：現在不存，之後就永遠存不到。**
 * 卡內嵌的 `character_book` 只是「**當下這個版本**」的出廠值；升級之後會被新版覆蓋，
 * 舊出廠值就消失了。屆時答不出「這條的開關是使用者改的、還是本來就關著」，
 * 升級只剩「全部重建、丟掉使用者設定」這一條笨路。
 * 實測佐證：標的卡兩份 38 條內容完全相同，但**關閉條數 29 vs 21** —— 使用者改過 8 條。
 */
import { createHash } from 'node:crypto';
import type { Card } from './card.ts';
import { fromCharacterBook, fromWorldFile, type WbEntry } from './worldbook.ts';

export type OriginSnapshot = {
  /** 來源卡片的版本識別。**不是給人看的，是給升級時比對用的。** */
  cardId: string;
  cardVersion: string;
  createDate: string;
  importedAt: string;
  /**
   * 🔴 出廠時每條 entry 的**開關 ＋ 身分證明**。這就是「之後做不到」的那一份。
   *
   * 🔴 **不可以只存 `uid → 開關`。** 實測卡內 `character_book[].id` 與外部 `uid`
   * 都是 **0…37 的陣列索引**，不是穩定 ID —— 作者在中間插一條，後面全部位移。
   * 只靠索引比對，升級時會把 A 條目的使用者設定**靜默套到 B 條目上**；
   * **這比「沒有 ID」更危險，因為它看起來像可用的。**
   * ⇒ 一起存 `comment`（名稱）與內容雜湊，升級時三順位比對：
   * 名稱相同 → 內容雜湊相同 → 都不中就當「刪除＋新增」並明示告知。**不准用索引猜。**
   */
  entries: Record<string, { enabled: boolean; comment: string; contentHash: string }>;
};

export type CharWorld = {
  version: 1;
  characterId: string;
  /**
   * 書名。🔴 **只有「沒有擁有者」的書會需要它**（匯入、全域）——
   * 好友那一份的名字就是好友的名字，卡片複製時不會寫這個欄位（省了一個會分岔的真相來源）。
   * 全域書的名字仍然存在 `Settings.globalWorlds`（既有機制不動），這裡是給**匯入但還沒
   * 綁定任何一層**的書用的，讓 `worldList.ts` 的清單與 `WorldPicker` 認得出它是哪一本
   * ——不然只會看到「（沒有擁有者的書）」，匯兩本以上就分不出誰是誰。
   */
  name?: string | undefined;
  /** 使用者可以改的那一份（開關改在這裡）。 */
  entries: WbEntry[];
  origin: OriginSnapshot;
};

type Bag = Record<string, unknown>;
const bag = (v: unknown): Bag => (v && typeof v === 'object' ? (v as Bag) : {});
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);

/**
 * 卡片的版本識別。用**內容雜湊**而不是版本字串：
 * 版本字串是作者手寫的，同一個版本號改內容的情況所在多有；雜湊不會騙人。
 */
export function cardIdentity(card: Card): { cardId: string; cardVersion: string; createDate: string } {
  const payload = card.payloads[card.primary];
  const data = bag(bag(payload)['data']);
  return {
    cardId: createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16),
    cardVersion: str(data['character_version'], '(未標版本)'),
    createDate: str(bag(payload)['create_date'], ''),
  };
}

/** 從卡片複製出這個好友專屬的世界書，並在**同一刻**留下出廠快照。 */
export function worldFromCard(card: Card, characterId: string, now: string): CharWorld {
  const payload = card.payloads[card.primary];
  const entries = fromCharacterBook(bag(bag(payload)['data'])['character_book']);
  const id = cardIdentity(card);
  return {
    version: 1,
    characterId,
    entries,
    origin: {
      ...id,
      importedAt: now,
      // 🔴 這裡刻意複製一份**值**而不是存 entries 的參照 ——
      // 使用者之後改的是 `entries`，快照必須留在出廠當下不動。
      entries: Object.fromEntries(
        entries.map((e) => [e.uid, { enabled: e.enabled, comment: e.comment, contentHash: contentHash(e.content) }]),
      ),
    },
  };
}

/**
 * 內容的正規化雜湊。**先正規化再算**：空白與換行的差異不該讓同一條內容看起來像兩條
 * （作者重排版面是常態）。
 */
export const contentHash = (content: string): string =>
  createHash('sha256').update(content.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 16);

/** 使用者把某條的開關改掉。**只動副本**，不碰卡片、不碰快照。 */
export function setEntryEnabled(world: CharWorld, uid: string, enabled: boolean): CharWorld {
  return { ...world, entries: world.entries.map((e) => (e.uid === uid ? { ...e, enabled } : e)) };
}

/** 現在跟出廠差在哪 —— 升級要用的就是這個。 */
export function driftFromOrigin(world: CharWorld): { uid: string; factory: boolean; now: boolean }[] {
  const out: { uid: string; factory: boolean; now: boolean }[] = [];
  for (const e of world.entries) {
    const o = world.origin.entries[e.uid];
    if (o && o.enabled !== e.enabled) out.push({ uid: e.uid, factory: o.enabled, now: e.enabled });
  }
  return out;
}

/**
 * 驗證＋轉換一份**已經 `JSON.parse` 過**的外部世界書檔（`{ entries: {...} }`）。
 * 結構錯就整個拒絕，不要噴一本空書 ——「沒讀到」與「讀到 0 條」必須看得出差異。
 *
 * 🔴 壞 JSON 本身不在這裡處理：呼叫端讓 `JSON.parse` 直接丟，`app.ts` 的
 * `onError` 會收成 400（「參數不合法：body 不是 JSON」）。
 * 個別欄位型別錯沿用 `fromWorldFile` 既有的容錯（缺什麼用預設）—— ST 自己也不驗這層，
 * 這裡只守「entries 這個殼本身」，殼歪了才回 400。
 */
export function parseWorldFile(
  json: unknown,
): { ok: true; name: string | undefined; entries: WbEntry[] } | { ok: false; error: string } {
  const top = bag(json);
  const rows = top['entries'];
  if (rows === undefined) return { ok: false, error: '缺少 entries 欄位 —— 這不是世界書檔' };
  if (typeof rows !== 'object' || rows === null || Array.isArray(rows)) {
    return { ok: false, error: 'entries 必須是「uid → 條目」的物件，不是陣列或其他型別' };
  }
  for (const [uid, v] of Object.entries(rows)) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      return { ok: false, error: `entries.${uid} 必須是一個物件` };
    }
  }
  return { ok: true, name: typeof top['name'] === 'string' ? top['name'] : undefined, entries: fromWorldFile(json) };
}
