/**
 * 這一輪的回覆裡如果帶了 `<UpdateVariable>`，把它套進這段對話的變數。
 *
 * 🔴 **這是「引擎接好了、沒有門」的第四次**（2026-08-27）。
 * `lib/varUpdate.ts`（解析）與 `lib/varApply.ts`（夾持後套用）寫好了、測過了、
 * `scripts/verify-vars.ts` 拿真卡跑得起來 —— 但**產品端有零個呼叫點**。
 * 於是使用者的親密度／安全感／面具**從第一天就沒有動過**，而且完全靜默。
 *
 * 🔴 **為什麼不是讓卡片自己算**：卡片本來靠 CDN 上的 MVU 做這件事，而 MVU 假設沙箱裡
 * 有全域 `Vue` 與 `z`(zod) —— 我們沒有 ⇒ 它載進來就炸，從來沒初始化過
 *（實機 stack：`ReferenceError: Vue is not defined at …/MagVarUpdate/artifact/bundle.js`）。
 * 補那兩個外部依賴等於把產品的核心狀態押在別人的 CDN 上，斷網或對方改版就沒有狀態。
 * ⇒ Peter 2026-08-27 裁定：我們自己算。前端那邊由 `runtime/mvuShim.ts` 扮演 `Mvu` 的介面。
 *
 * 🔴 **值要寫進 `stat_data`，不是頂層**（2026-08-27 實機才看出來）。
 * 卡片讀的是 `getAllVariables().stat_data`（桌寵的 `readState()` 就是這樣寫的）——
 * 那是 MVU 的慣例。我們扮演 MVU 就得**寫在 MVU 會寫的地方**：
 * 值放頂層的話卡片一個都讀不到，而畫面上是三個 `—`，沒有任何錯誤。
 * ⚠️ Peter 手機截圖上「時期」有值、三個數字是 `—`，那個不對稱正是這條的指紋。
 *
 * 🔴 **失敗一律不擋生成。** 這一段是在訊息已經存下來之後跑的 —— 解析壞掉、卡片沒有變數、
 * schema 推不出來，都只是「這一輪沒有數值變化」，不可以讓使用者的回覆消失。
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
 *
 * 🔴 約束不是卡片給的，是我們加的：那張卡的世界書自己寫著「單輪超過 ±3 會被夾回」，
 * 但那是**寫給 LLM 看的提示詞** —— 靠它自律總有一天不自律。
 * ⇒ 夾持要在套用前發生（`varApply.ts` 檔頭的同一條）。
 * ⚠️ 開場前兩樓豁免：開場白本來就會一次把數值設到位。
 *
 * ⚠️ `scripts/verify-vars.ts` 有一份一模一樣的手寫版，該改吃這支（已記在 TASKS.md）。
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

  /**
   * 🔴 **沒有值的時候要從卡片的初始值長出來，不是從空物件。**
   * `delta` 是相對的 —— 底下沒有基準的話第一輪就永遠算不出來。
   * ⚠️ 只補「這個 schema 宣告過的」，卡片自己存的其他東西（桌寵的位置…）原封不動。
   */
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
 *
 * ⚠️ **一律不擋生成**：訊息這時已經在 `chat.messages` 裡了 —— 解析壞掉、卡片沒有變數、
 * schema 推不出來，都只是「這一輪沒有數值變化」，不可以讓使用者的回覆消失。
 * 🔴 **夾持與丟棄要留痕跡**：「為什麼數值不動」以後就是靠這一行查。
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
 * 一輪生成結束時的落地：把回覆存成一則訊息、套用這一輪的變數更新、寫檔。
 *
 * 🔴 **抽到這裡是因為 `generate.ts` 卡在 150 行**，而這三件事本來就是同一個「收尾」——
 * 而且順序是有意義的：訊息先進 `messages`（`樓層` 要算得到它），變數才算得對。
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
