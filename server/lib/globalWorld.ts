import { randomUUID } from 'node:crypto';
import { type CharWorld, contentHash } from './charWorld.ts';
import { type WbEntry, WI_POSITION } from './worldbook.ts';

/**
 * 全域世界書 —— **所有對話都會套用的那一種**（Peter 2026-08-27）。
 *
 * 🔴 **這一層在引擎裡早就存在**：`wiLayers.ts` 的 `orderLayers()` 已經吃 `global`，
 * 連 `CHAR_STRATEGY`（global 與 character 誰先）都照 ST 抄好了。
 * 缺的只是「哪幾本算全域」這份名單，以及把它傳進去 —— 又一次的「引擎有了、門沒有」。
 *
 * 🔴 **儲存直接重用 `worlds/<id>.json`**，與好友那一份副本同一種檔。
 * 差別只在 id：好友那份的 id 是 characterId，全域這份是自己生的 uuid。
 * ⚠️ 所以編輯條目、開關條目**完全沿用既有端點**（它們只認 id，不驗角色存在）——
 * 不另外做一套會分岔的讀寫。
 *
 * 🔴 對照 ST：它把全域清單存在 `settings.world_info.globalSelect`
 * （`world-info.js:85,998`），UI 標籤是 "Active World(s) for all chats"
 * （`public/index.html:4687`）。我們的 `Settings.globalWorlds` 就是同一件事。
 */

/** 全域世界書的 `characterId` 欄位放這個 —— 它不屬於任何角色。 */
export const GLOBAL_OWNER = '__global__';

/**
 * 🔴 **匯入但還沒綁到任何一層**的書用這個，**不是 `GLOBAL_OWNER`**。
 * `$worldId/index.tsx` 用 `characterId === GLOBAL_OWNER` 判斷要不要顯示
 * 「這是全域世界書，會套用到你所有對話」那句警告 —— 剛匯入、還沒加進
 * `Settings.globalWorlds` 的書如果也標成 `GLOBAL_OWNER`，那句警告就是謊言
 * （它其實還沒套用到任何地方）。兩個狀態語意不同，字面值也要分開。
 */
export const IMPORTED_OWNER = '__imported__';

/** 條目的預設值。🔴 **匯出**：內建樣板庫（`worldPresets.ts`）要用同一組預設，
 *  不然「樣板長什麼樣」會有兩份會分岔的定義。 */
export const wbEntry = (
  e: Partial<WbEntry> & { uid: string; comment: string; content: string },
): WbEntry => ({
  keys: [],
  secondaryKeys: [],
  constant: false,
  enabled: true,
  selective: false,
  selectiveLogic: 0,
  order: 100,
  position: WI_POSITION.beforeChar,
  depth: 4,
  role: null,
  caseSensitive: false,
  matchWholeWords: false,
  probability: 100,
  useProbability: false,
  group: '',
  ignoreBudget: false,
  raw: {},
  ...e,
});

/**
 * 🔴 **樣板的三條是刻意選的：一條示範一種觸發方式。**
 * 使用者第一次進來時，需要的不是一本空書，而是**看得懂機制的三個例子**
 * ——常駐、關鍵字、插在對話裡。每一條的 `content` 都寫成「可以直接改的實用內容」，
 * 不是 lorem。三條**預設都關著**：一本剛建好的書不該立刻改變你所有對話的行為。
 */
export function templateWorld(): { id: string; world: CharWorld } {
  return makeWorld([
    wbEntry({
      uid: '1',
      comment: '常駐 · 回覆風格',
      content:
        '請用繁體中文回覆。避免條列與總結式的收尾，讓對話像對話，而不是報告。',
      constant: true,
      enabled: false,
      order: 200,
      position: WI_POSITION.beforeChar,
    }),
    wbEntry({
      uid: '2',
      comment: '關鍵字 · 世界觀設定',
      content:
        '（把你的世界觀寫在這裡。只有當對話裡出現下面任一個關鍵字時，這段才會被送進去。）',
      keys: ['世界觀', '設定', '背景'],
      enabled: false,
      order: 100,
      position: WI_POSITION.beforeChar,
    }),
    wbEntry({
      uid: '3',
      comment: '插在對話裡 · 每輪提醒',
      content: '（寫一句你希望模型每一輪都記得的話，例如格式或稱呼方式。）',
      constant: true,
      enabled: false,
      order: 50,
      position: WI_POSITION.atDepth,
      depth: 2,
    }),
  ]);
}

/**
 * 把一疊條目包成一本全域世界書。🔴 **匯出給內建樣板庫共用**。
 *
 * `origin` 是「出廠快照」，用來標示哪幾條被改過。**自建的書出廠就等於現況**
 * ⇒ 一建好就是「0 條被改」，這是對的：改動的基準點是樣板，不是某張卡。
 * ⚠️ 卡片來源的欄位（`cardId`／`cardVersion`／`createDate`）留空字串 ——
 * 這本書**不是從卡片來的**，填假的來源比留空更糟（升級比對會拿它去猜）。
 *
 * 🔴 `opts` 是給**匯入**用的：`characterId` 覆蓋預設的 `GLOBAL_OWNER`
 * （匯入但還沒綁定的書要用 `IMPORTED_OWNER`，見上面那個常數的註解）；
 * `name` 是書名（`worldList.ts` 的清單與 `WorldPicker` 認出是哪一本靠它）。
 * 兩者都不帶就是原本的行為（樣板／空白全域書），呼叫端不用改。
 */
export function makeWorld(
  entries: WbEntry[],
  opts?: { characterId?: string; name?: string },
): { id: string; world: CharWorld } {
  return {
    id: randomUUID(),
    world: {
      version: 1,
      characterId: opts?.characterId ?? GLOBAL_OWNER,
      ...(opts?.name ? { name: opts.name } : {}),
      entries,
      origin: {
        cardId: '',
        cardVersion: '',
        createDate: '',
        importedAt: new Date().toISOString(),
        entries: Object.fromEntries(
          entries.map((e) => [
            e.uid,
            { enabled: e.enabled, comment: e.comment, contentHash: contentHash(e.content) },
          ]),
        ),
      },
    },
  };
}
