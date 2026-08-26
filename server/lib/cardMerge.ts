import type { Card, CardKeyword } from './card.ts';
import { CARD_KEYWORDS } from './card.ts';

/**
 * 把**我們擁有的欄位**合併回卡片，其餘一個都不動（GAP-66）。
 *
 * 🔴 **為什麼需要這支**：我們的編輯只寫 `characters/<id>.json` 那份投影
 * （`characterEdit.ts`，與 `displayName`「永不寫回角色卡」同一條原則），
 * 但匯出是**從 PNG 重建**（`characterMedia.ts`）⇒ **使用者編輯過的東西匯出後會消失**。
 * ⚠️ ST 的做法相反：它每次編輯都把整包重寫進 PNG，PNG 是唯一正本。
 * 我們不學它 —— 但也不能讓編輯憑空不見。
 *
 * 🔴 **只准寫你擁有的鍵**（memory `正規化寫回＝資料損毀`）。
 * 判準是「無資訊遺失」**不是位元組相等**：卡裡那幾十個我們還沒實作的欄位、
 * 世界書、regex、別人的擴充資料，**原樣留著**。
 * ⇒ 這裡只碰三個鍵，而且**寫回它原本所在的那一層**（V2 在 top-level、V3 在 `data`）。
 *
 * 🔴 **`name` 不在名單裡。** 改名寫的是 `displayName`（D-h），永不寫回卡片
 * —— 同一張卡加入多次時第二個起會是「某某(1)」，把那個寫回去等於污染別人的卡。
 *
 * 🔴 **兩份 payload 各自寫。** `chara`(v2) 與 `ccv3`(v3) 內容不保證相同
 * （實測標的卡兩者長度差 1 byte），只寫一份會讓兩份分岔。
 */
export type OwnedFields = {
  description: string;
  firstMessage: string;
  /** 🔴 **額外問候語，不含第一則** —— 對應卡片的 `alternate_greetings`。 */
  alternateGreetings: string[];
};

type Bag = Record<string, unknown>;
const isBag = (v: unknown): v is Bag => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * 把一個鍵寫進它**原本所在的那一層**。
 * 兩層都沒有時：有 `data` 就寫 `data`（V3 的形狀），否則寫 top-level。
 */
function put(root: Bag, key: string, value: unknown): Bag {
  const data = isBag(root['data']) ? root['data'] : null;
  if (data && key in data) return { ...root, data: { ...data, [key]: value } };
  if (key in root) return { ...root, [key]: value };
  if (data) return { ...root, data: { ...data, [key]: value } };
  return { ...root, [key]: value };
}

function mergeOne(payload: unknown, owned: OwnedFields): unknown {
  // 🔴 不是物件就原樣退回 —— 我們不知道那是什麼，不要猜著改。
  if (!isBag(payload)) return payload;
  let next = put(payload, 'description', owned.description);
  next = put(next, 'first_mes', owned.firstMessage);
  next = put(next, 'alternate_greetings', owned.alternateGreetings);
  return next;
}

export function mergeOwned(card: Card, owned: OwnedFields): Card {
  const payloads: Partial<Record<CardKeyword, unknown>> = {};
  for (const kw of CARD_KEYWORDS) {
    const p = card.payloads[kw];
    if (p !== undefined) payloads[kw] = mergeOne(p, owned);
  }
  return { payloads, primary: card.primary };
}
