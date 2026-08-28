/**
 * 這一輪的回覆裡如果帶了 `<UpdateVariable>`，把它套進這段對話的變數。
 *
 * 🔴 **「引擎接好了、沒有門」的第四次**（2026-08-27）：`lib/varUpdate.ts`（解析）與
 * `lib/varApply.ts`（夾持後套用）寫好了、測過了，但**產品端零呼叫點** ⇒ 親密度／
 * 安全感／面具從第一天就沒動過，而且完全靜默。
 *
 * 🔴 **不讓卡片自己算**：卡片本來靠 CDN 上的 MVU，但它假設沙箱裡有全域 `Vue`／`z`(zod)——
 * 我們沒有 ⇒ 一載入就炸（實機：`ReferenceError: Vue is not defined`），而且把核心狀態
 * 押在別人的 CDN 上。⇒ Peter 2026-08-27 裁定我們自己算；前端由 `runtime/mvuShim.ts`
 * 扮演 `Mvu` 介面。
 *
 * 🔴 **值要寫進 `stat_data`，不是頂層**：卡片讀 `getAllVariables().stat_data`（MVU 慣例）。
 * ⚠️ 放頂層卡片讀不到、畫面顯示三個 `—` 卻沒有任何錯誤（Peter 手機截圖抓到過）。
 * 🔴 **失敗一律不擋生成**：訊息已經存下來之後才跑這段，解析壞掉只算「沒有數值變化」。
 */
import { readBin, writeJson } from '../adapters/storage.ts';
import { readCard } from '../lib/card.ts';
import { deriveConfig } from '../lib/deriveConfig.ts';
import { applyWithConstraints, type Change } from '../lib/varApply.ts';
import { initialState, type State, type VarSchema } from '../lib/vars.ts';
import { parseUpdateBlock, proposalsFrom } from '../lib/varUpdate.ts';
import { stageOf } from '../lib/mvuStage.ts';

/**
 * 卡片的變數宣告 ＋ **引擎層的約束**。
 * 🔴 約束是我們加的，不是卡片給的：卡片的世界書寫著「單輪超過 ±3 會被夾回」，但那是
 * **寫給 LLM 看的提示詞**——靠它自律總有一天不自律，夾持要在套用前發生。
 * ⚠️ 開場前兩樓豁免（開場白本來就會一次把數值設到位）；`scripts/verify-vars.ts`
 * 有一份一模一樣的手寫版，該改吃這支（已記在 TASKS.md）。
 */
export function schemaOf(cardJson: unknown): VarSchema | null {
  const { config } = deriveConfig(cardJson);
  if (config.variables.length === 0) return null;
  const numeric = config.variables.filter((v) => v.type === 'number').map((v) => v.name);
  return {
    // 🔴 `時期` 由開場白決定、局內不可改 —— 卡片的世界書講得很清楚。
    variables: config.variables.map((v) => (v.name === '時期' ? { ...v, readonly: true } : v)),
    derived: [],
    constraints: numeric.map((name) => ({
      var: name,
      maxDeltaPerTurn: 3,
      clamp: [0, 100] as [number, number],
      exemptWhen: '樓層 < 2',
    })),
  };
}

/** 🔴 MVU 把資料存在這個鍵底下 —— 卡片就是照這個鍵讀的（見檔頭）。 */
export const STAT_KEY = 'stat_data';
export type VarUpdate = { state: State; changes: Change[]; rejected: string[] };

/**
 * 套用一次更新。回 `null` ＝ 這一輪沒有任何變化（沒有區塊、卡片沒有變數、或解析不出來）。
 * 🔴 **`reply` 要傳原文**：`<UpdateVariable>` 正是被顯示規則拿掉的那一塊。
 */
export async function applyVarUpdate(
  characterId: string,
  reply: string,
  current: Record<string, unknown>,
  turn: number,
): Promise<VarUpdate | null> {
  const parsed = parseUpdateBlock(reply);
  if (parsed.ops.length === 0) return null;

  const png = await readBin(`characters/${characterId}.png`).catch(() => null);
  if (!png) return null;
  const card = readCard(png);
  const schema = schemaOf(card.payloads[card.primary]);
  if (!schema) return null;

  // 🔴 沒有值時從卡片的初始值長出來，不是空物件——`delta` 是相對的，沒基準就永遠算不出來。
  // ⚠️ 只補 schema 宣告過的，卡片自己存的其他東西（桌寵的位置…）原封不動。
  const stat = (current[STAT_KEY] ?? {}) as Record<string, unknown>;
  const base: State = { ...initialState(schema), ...pickDeclared(schema, stat) };
  const r = applyWithConstraints(base, proposalsFrom(parsed.ops, base), schema, { 樓層: turn });
  // 🔴 `階段` 是那張卡的 schema 自己 transform 出來的 —— MVU 會存，我們也要存（見 `mvuStage`）。
  const state: State = { ...r.state, 階段: stageOf(r.state) };
  return { state, changes: r.changes, rejected: r.rejected.map((x) => x.name) };
}

const pickDeclared = (schema: VarSchema, from: Record<string, unknown>): State => {
  const out: State = {};
  for (const v of schema.variables) if (v.name in from) out[v.name] = from[v.name];
  return out;
};

/**
 * 生成端點用的一行版：算出這一輪之後的 `chat.variables`。
 * ⚠️ **一律不擋生成**：訊息已經在 `chat.messages` 裡了——解析壞掉只算「沒有數值變化」。
 * 🔴 夾持與丟棄要留痕跡：「為什麼數值不動」以後就是靠這一行查。
 */
export async function varsAfter(
  chat: { characterId: string; variables?: Record<string, unknown> | undefined; messages: unknown[] },
  reply: string,
): Promise<Record<string, unknown>> {
  const before = chat.variables ?? {};
  try {
    const v = await applyVarUpdate(chat.characterId, reply, before, chat.messages.length);
    if (!v) return before;
    const moved = v.changes.map(
      (c) => `${c.name} ${String(c.from)}→${String(c.to)}${c.note ? `（${c.note}）` : ''}`,
    );
    if (moved.length > 0 || v.rejected.length > 0)
      console.log(
        `[vellum] 變數：${moved.join('、') || '（無變化）'}` +
          (v.rejected.length > 0 ? `｜拒絕 ${v.rejected.join('、')}` : ''),
      );
    // 🔴 併進 `stat_data`，不要動卡片自己存在頂層的東西（桌寵的位置就在那裡）。
    return { ...before, [STAT_KEY]: { ...((before[STAT_KEY] ?? {}) as object), ...v.state } };
  } catch (e) {
    console.error('[vellum] 變數更新失敗（不影響這一則回覆）：', e);
    return before;
  }
}

/**
 * 一輪生成結束時的落地：訊息進 `messages`、套用變數、寫檔。
 * 🔴 抽到這裡是因為 `generate.ts` 卡在 150 行；順序有意義——訊息先進去，`樓層` 才算得到它。
 */
export async function commitTurn(
  chatId: string,
  chat: { characterId: string; variables?: Record<string, unknown> | undefined; messages: unknown[] },
  reply: string,
): Promise<{ id: string; role: 'model'; text: string; at: string }> {
  const msg = { id: crypto.randomUUID(), role: 'model' as const, text: reply, at: new Date().toISOString() };
  chat.messages.push(msg);
  chat.variables = await varsAfter(chat, reply);
  await writeJson(`chats/${chatId}.json`, chat);
  return msg;
}

/**
 * 停止生成時的落地：只存字，**不套 `<UpdateVariable>`**（跨層票 H1／H6，2026-08-28；鎖期間歸 H1）
 * ——中止點不保證停在完整區塊後，半句 JSONPatch 會寫壞變數。`partial:true` 供 `buildTurn.ts` 讀。
 */
export async function commitPartialTurn(
  chatId: string,
  chat: { messages: unknown[] },
  partialText: string,
): Promise<{ id: string; role: 'model'; text: string; at: string; partial: true }> {
  const msg = {
    id: crypto.randomUUID(), role: 'model' as const, text: partialText,
    at: new Date().toISOString(), partial: true as const,
  };
  chat.messages.push(msg);
  await writeJson(`chats/${chatId}.json`, chat);
  return msg;
}
