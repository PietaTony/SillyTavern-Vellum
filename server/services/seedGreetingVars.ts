/**
 * 開場白落地時，把它自己帶的 `<UpdateVariable>` 套成這段對話的**起始變數**。
 *
 * 🔴 **這是「引擎接好了、沒有門」的第六次**（2026-08-27 實機）。
 * `varsAfter()` 只有一個呼叫端 —— `commitTurn()`，而那支只在**生成**時跑。
 * 開場白不是生成出來的（`POST /chats` 直接把它寫成第 0 則），
 * ⇒ 開場白裡的 `<UpdateVariable>` **從來沒有人套過** ⇒ 新對話的 `chat.variables`
 * 根本沒有 `stat_data` 這個鍵 ⇒ 卡片的 `_.get(all,'stat_data',{})` 拿到空物件，
 * 桌寵面板上三個數字全是 `—`、`時期` 掉回它自己的 fallback `'成年'`。
 * ⚠️ 九則開場白裡有八則帶 `<UpdateVariable>`，其中三則把 `時期` 設成
 * `童年`／`學生` —— 沒有這一支，選了童年線的對話會拿著**成年線的數值**開局，
 * 而且畫面上完全看不出來（見 [[vellum-orphan-engine-pattern]]）。
 *
 * 🔴 **`時期` 在這裡必須可寫。** `schemaOf()` 把它標成 `readonly`，那條規則的原文是
 * 「由**開場白**設定後凍結，局內不更新」—— 而這支跑的正是「開場白設定」那一刻。
 * 拿生成用的 schema 直接套的話，`/時期` 會被 `varApply` 以「局內不可更新」丟掉，
 * 於是童年線的開場白照樣寫不進 `時期`。⇒ 只在這條路上解除唯讀。
 *
 * 🔴 **樓層傳 0**：卡片的世界書寫著「開場白前兩樓豁免 ±3」—— 開場白本來就會一次
 * 把數值設到位（親密度 20→0、面具 85→60），照生成的規則夾會夾成一堆錯值。
 */
import { readBin } from '../adapters/storage.ts';
import { readCard } from '../lib/card.ts';
import { stageOf } from '../lib/mvuStage.ts';
import { applyWithConstraints } from '../lib/varApply.ts';
import { initialState, type State, type VarSchema } from '../lib/vars.ts';
import { parseUpdateBlock, proposalsFrom } from '../lib/varUpdate.ts';
import { schemaOf, STAT_KEY } from './applyVarUpdate.ts';

/** 開場白那一刻的 schema：跟生成時同一份，只是 `時期` 解除唯讀（見檔頭）。 */
const openingSchema = (s: VarSchema): VarSchema => ({
  ...s,
  variables: s.variables.map((v) => ({ ...v, readonly: false })),
});

/**
 * 純函式版：卡片 ＋ 開場白原文 → 這段對話的起始 `stat_data`。
 * 回 `null` ＝ 這張卡沒有變數、或這則開場白沒有 `<UpdateVariable>`（兩者都不是錯誤）。
 *
 * 🔴 **基準是卡片的初值，不是上一條線留下的值。** 換開場＝換一條時間線，
 * 沿用舊值的話「童年線的親密度」會從成年線的 23 開始。
 */
export function seedStateFrom(cardJson: unknown, greeting: string): State | null {
  const parsed = parseUpdateBlock(greeting);
  if (parsed.ops.length === 0) return null;
  const schema = schemaOf(cardJson);
  if (!schema) return null;

  const base = initialState(schema);
  const open = openingSchema(schema);
  const r = applyWithConstraints(base, proposalsFrom(parsed.ops, base), open, { 樓層: 0 });
  // `階段` 是卡片 schema 自己 transform 出來的 —— MVU 會存，我們扮演它就也要存。
  return { ...r.state, 階段: stageOf(r.state) };
}

/**
 * 建立對話／換開場時用的一行版：算出這段對話落地後的 `chat.variables`。
 *
 * ⚠️ **一律不擋建立對話**：卡片讀不到、schema 推不出來、開場白沒帶更新區塊，
 * 都只是「這段對話沒有起始數值」，不可以讓使用者連對話都開不起來。
 * 🔴 **併進 `stat_data`，其餘頂層的鍵原封不動** —— 桌寵把自己的位置與尺寸存在那裡。
 */
export async function varsForGreeting(
  characterId: string,
  greeting: string,
  current: Record<string, unknown> | undefined,
): Promise<Record<string, unknown>> {
  const before = current ?? {};
  try {
    const png = await readBin(`characters/${characterId}.png`).catch(() => null);
    if (!png) return before;
    const card = readCard(png);
    const state = seedStateFrom(card.payloads[card.primary], greeting);
    if (!state) return before;
    console.log(
      `[vellum] 開場白起始變數：${Object.entries(state)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join('、')}`,
    );
    return { ...before, [STAT_KEY]: { ...((before[STAT_KEY] ?? {}) as object), ...state } };
  } catch (e) {
    console.error('[vellum] 開場白起始變數算不出來（不影響這段對話）：', e);
    return before;
  }
}
