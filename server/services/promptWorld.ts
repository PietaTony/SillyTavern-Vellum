/**
 * 把世界書接進 prompt 組裝。
 *
 * 🔴 **這又是一個「引擎做好了但沒有門」**：選／排裁／插三步早就寫完並驗過（B2），
 * 但 `generate.ts` 從來沒有呼叫過它們 —— 對使用者來說等於世界書不存在。
 *
 * 🔴 **同一個 depth 撞在一起時的絕對順序：世界書 ＞ persona ＞ 角色卡**（規格 §4.4）。
 * 不定死的話每次組裝順序可能不同 ⇒ 破壞 prompt cache 前綴。
 */
import type { CharWorld } from '../lib/charWorld.ts';
import type { Chat } from './chatModel.ts';
import type { Persona } from '../lib/persona.ts';
import { loadSettings } from './settings.ts';
import { readJson } from '../adapters/storage.ts';
import { planInjection, type InjectionPlan } from '../lib/wiInject.ts';
import { orderLayers } from '../lib/wiLayers.ts';
import { buildScanText, selectEntries, type ScanMessage } from '../lib/wiSelect.ts';
import type { WbEntry } from '../lib/worldbook.ts';

/** 同 depth 的插入優先序。數字小的**最後插入**，因此排在最前面。 */
export const DEPTH_PRIORITY = { world: 0, persona: 1, card: 2 } as const;

/**
 * 🔴 **世界書的 token 預算，暫時是常數，不是設定。**
 *
 * `wiInject.ts` 的 `planInjection()` 完整支援 `opts.budget`——爆掉的條目會被裁進
 * `plan.trimmed`，看得見、不靜默消失。但**全 repo 唯一的生產呼叫端**（下面這支
 * `worldForChat`）過去沒有傳 `opts`，等於 `budget` 恆為 `undefined`：
 * 不管世界書塞了幾百條、多長，一條都不會被裁——引擎接好了，門沒開。
 *
 * 這個常數就是那道門，但只開了一半：
 * ① **本來該是使用者可調的設定**（對照 ST 的 `world_info_budget`），但存放使用者可調設定
 *    要動 `server/lib/settingsModel.ts` / `server/services/settings.ts`——那兩支是
 *    `AGENTS.md` §2 的 X3（跨層無主區，四個以上領域在讀，改動要開票給 Peter 簽）。
 *    這裡先用常數把「永遠不裁」這個更急迫的洞補起來，可調版本待 X3 票。
 * ② **單位是字元數，不是 token**（同 `wiInject.ts` 的 `BudgetOpts.count` 說明）：
 *    本專案還沒有 tokenizer，`chars/4` 之類的估算是把假的尺當真的量。
 *    這裡選一個**寬鬆**的字元數上限，只當「防止無限塞爆」的安全網，不是精算的 token 上限
 *    ——精算需要真的 tokenizer，那同樣不在這支的範圍內。
 * ③ 🔴 **20000 這個數字沒有量測支撐，是初步防線，不是校準過的安全邊界。**
 *    repo 裡目前沒有真實世界書資料可以估算量級——`default/`／`docs/`／
 *    `server/__tests__/` 底下的 `content` 全是 `'c'`／`'內容'`／`'x'.repeat(20)`
 *    這類佔位字串，拿它們估「一般大小的世界書」是在量空氣。
 *    而且至少兩個因素會讓這個閾值比字面數字看起來更容易撞到：
 *    - budget 套的是 `sel.activated`（已經比對過關鍵字），但 `constant: true`
 *      的條目**不比對關鍵字、每輪必進場**——多條常駐設定（世界觀基礎、角色關係圖）
 *      逐輪疊加，不受「只有命中的才進場」這層篩選保護。
 *    - 這個 app 是中文為主，而中文的 token/字元比遠高於英文
 *      （多數 tokenizer 對中文接近或超過 1 token/字，英文約 0.25）——
 *      用英文直覺覺得「20000 字元很寬鬆」，套到中文內容會低估用掉的 token。
 *    待有真實使用資料後再校準這個數字；在那之前把它當「防止無限塞爆」的
 *    安全網，不要當成「一般世界書不會被裁」的保證。
 */
export const DEFAULT_WI_BUDGET = 20_000;

export type WorldOutcome = {
  plan: InjectionPlan;
  /** 掃了幾條、幾條進場 —— 🔴 0 條要看得出來是「沒有世界書」還是「都沒命中」。 */
  scanned: number;
  total: number;
  activated: number;
  /**
   * 🔴 幾條被 token 預算裁掉、沒進最終 prompt（`plan.trimmed.length`）。
   * 獨立成一個數字欄位是刻意的：呼叫端不必知道要去挖 `plan.trimmed` 才看得到「有東西被裁」，
   * 一個計數就攤在跟 `scanned`／`activated` 同一層——這正是本檔案「別把『沒量到』
   * 跟『量過沒事』做成同一個空陣列」的原則（見 H3 §5）。
   */
  trimmed: number;
  /**
   * 🔴 A1（GAP-53）：`anTop`／`anBottom`／`emTop`／`emBottom` 四個桶算出來了、
   * 沒有消費者（`worldSystemText`／`worldDepthPieces` 只讀另外三個）。查證見
   * `src/features/worldbook/fields.ts` 檔頭：兩邊都缺 ST 賴以定位的錨點
   * （Author's Note、範例對話），不猜位置，選擇算出來但不接線、畫面上明說。
   * 跟 `trimmed` 同理：`activated` 混著這些條目，只看那個數字會誤以為文字進了 prompt。
   */
  unconsumedPositions: number;
};

/**
 * 這一段對話這一輪的世界書。
 * 層別：好友那本是 **character 層**，persona 那本是 **persona 層**（規格 §2.3 的四層之二）。
 */
export async function worldForChat(
  chat: Chat,
  persona: Persona | null,
  messages: ScanMessage[],
): Promise<WorldOutcome> {
  const own = await readJson<CharWorld | null>(`worlds/${chat.characterId}.json`, null);
  const personaWorld = persona?.lorebookId
    ? await readJson<CharWorld | null>(`worlds/${persona.lorebookId}.json`, null)
    : null;

  /**
   * 🔴 **全域層**（Peter 2026-08-27）。「所有對話都套用」的那幾本。
   * ⚠️ **在此之前這一層永遠是空的** —— `orderLayers()` 早就吃 `global`、
   * 連 `CHAR_STRATEGY`（global 與 character 誰先）都照 ST 抄好了，
   * 但沒有任何地方告訴它「哪幾本算全域」。**引擎有了、門沒有**，這裡就是那道門。
   * 名單在 `settings.globalWorlds`（對照 ST 的 `settings.world_info.globalSelect`）。
   */
  const globals: WbEntry[] = [];
  for (const b of (await loadSettings()).globalWorlds ?? []) {
    const w = await readJson<CharWorld | null>(`worlds/${b.id}.json`, null);
    if (w) globals.push(...w.entries);
  }

  const ordered = orderLayers({
    global: globals,
    character: own?.entries ?? [],
    persona: personaWorld?.entries ?? [],
  });
  const scan = buildScanText(messages, 4);
  const sel = selectEntries(ordered, scan);
  const plan = planInjection(sel.activated, { budget: DEFAULT_WI_BUDGET });
  if (plan.trimmed.length > 0) {
    // 🔴 使用者今天看不到這行——這支是 server 端服務，沒有回應通道能把「被裁掉」
    // 帶到 UI。至少讓它在伺服器日誌上可見（同檔案其他「靜默失敗」的既有做法，
    // 見 `seedGreetingVars.ts`／`applyVarUpdate.ts` 的 `[vellum]` 慣例），
    // 並把計數放進回傳的 `WorldOutcome.trimmed`，讓呼叫端（`buildTurn.ts`）
    // 之後要接到 UI 時，資料已經在門口，不必回頭再挖一次 `plan.trimmed`。
    console.warn(
      `[vellum] 世界書被預算裁掉 ${plan.trimmed.length}/${sel.activated.length} 條，未進 prompt（budget=${DEFAULT_WI_BUDGET} 字元）`,
    );
  }
  // 🔴 A1（GAP-53）：這四個桶算出來但沒有消費者（見上面 WorldOutcome.unconsumedPositions
  // 檔頭），跟 plan.trimmed 同一個理由印一行 log——伺服器日誌是唯一看得到的管道。
  const unconsumedPositions =
    plan.anTop.length + plan.anBottom.length + plan.emTop.length + plan.emBottom.length;
  if (unconsumedPositions > 0) {
    console.warn(
      `[vellum] 世界書有 ${unconsumedPositions} 條落在 anTop/anBottom/emTop/emBottom，這四個位置目前沒有消費者，不會進 prompt（GAP-53）`,
    );
  }
  return {
    plan,
    scanned: sel.scanned,
    total: ordered.length,
    activated: sel.activated.length,
    trimmed: plan.trimmed.length,
    unconsumedPositions,
  };
}

/** 世界書要併進 system 的部分。`beforeChar` 在角色描述之前、`afterChar` 在之後。 */
export const worldSystemText = (plan: InjectionPlan): string[] => [...plan.beforeChar, ...plan.afterChar];

/** 世界書要插進對話中的部分，帶上優先序。 */
export const worldDepthPieces = (plan: InjectionPlan): { depth: number; priority: number; text: string }[] =>
  plan.atDepth.map((b) => ({ depth: b.depth, priority: DEPTH_PRIORITY.world, text: b.entries.join('\n') }));
