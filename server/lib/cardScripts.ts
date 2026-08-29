import { createHash } from 'node:crypto';
import { externalsOf } from './cardExternals.ts';

/**
 * 角色卡自帶的程式（M13 第二期 · 資料層）。
 *
 * 🔴 **卡片會自己帶 JavaScript，而且帶在兩個不同的地方。**
 *   ① `extensions.tavern_helper.scripts` —— 背景腳本。實測那張卡有 **2,084,371 字元**、7 支，
 *      其中 99.2% 是「桌寵」那支的內嵌貼圖，真正的功能腳本只有約 17 KB。
 *   ② 🔴 `extensions.regex_scripts[].replaceString` —— **顯示用 regex 把整段訊息換成一份 HTML 網頁**。
 *      實測「測試卡A」那張卡使用者真正看到、會點的「CHOOSE YOUR TIMELINE」介面
 *      就是這樣來的（`regex_scripts[1]`，17,862 字元，裡面有 `<script>` 與 15 個 `onclick=`）。
 *
 * ⚠️ **2026-08-26 補的就是 ②。** 在此之前盤點只算 ①，於是同意視窗
 * **少報了真正會執行、而且第二期就會跑起來的那一份**。
 *
 * 🔴 **這一支只做「盤點」，不做「執行」。**
 *
 * 🔴 **外連的量尺在 `cardExternals.ts`** —— 指紋蓋不到 CDN，所以同意流程要
 * **針對網域另外問一次**（Peter 2026-08-26 裁「乙」）。理由寫在那支的檔頭。
 */

export type CardScript = {
  name: string;
  /** 卡片作者自己標的開關。**不是我們的同意** —— 兩件事不要混。 */
  enabled: boolean;
  /** 內容長度（字元）。給同意視窗顯示規模用。 */
  bytes: number;
  /** 🔴 這段程式會去哪些網域抓 code。空陣列 ＝ 完全自足。 */
  externals: string[];
  /**
   * `script` ＝ 背景腳本（`tavern_helper`）｜`interface` ＝ 會變成畫面的那份 HTML（`regex_scripts`）。
   * 🔴 **同意視窗要分開講**：一個是看不見的，一個是使用者會直接點的。
   */
  kind: 'script' | 'interface';
};

/** 盤點結果。存進角色檔，**不含程式內容**（2 MB 塞進 character JSON 會拖垮每一次列表）。 */
export type CardScripts = {
  scripts: CardScript[];
  /** 內容指紋。卡片更新後要重新詢問，靠它比對。⚠️ 它蓋不到 CDN，見檔頭。 */
  hash: string;
};

/**
 * 這段內容是不是「一份完整的網頁」。
 * 🔴 **與前端的 `isFrontend()` 是雙胞胎**（`src/features/chat/render/frontend.ts`）——
 * 兩邊判準一旦分岔，就會出現「盤點說沒有、畫面卻把它跑起來」的破口。
 * 由 `server/__tests__/cardScripts.test.ts` **用行為比對釘住**（不是比字串，比字串搬檔就失效）。
 */
export const isCardInterface = (code: string): boolean =>
  ['html>', '<head>', '<body'].some((tag) => code.includes(tag));

/** 盤點前的中間形狀：三個欄位就夠算指紋，也夠產出 `CardScript`。 */
type Raw = { name: string; content: string; enabled: boolean };

const toEntries = (raw: Raw[], kind: CardScript['kind']): CardScript[] =>
  raw.map((r) => ({
    name: r.name,
    enabled: r.enabled,
    bytes: r.content.length,
    externals: externalsOf(r.content),
    kind,
  }));

/** 指紋：名稱＋**內容本身**。用長度會漏掉「同長度換內容」，那正是要重問的情況。 */
const fingerprintOf = (raw: Raw[]): string => {
  const h = createHash('sha256');
  for (const r of raw) h.update(`${r.name} ${r.content} `);
  return h.digest('hex').slice(0, 16);
};

const text = (v: unknown, fallback: string): string =>
  typeof v === 'string' && v.trim() !== '' ? v : fallback;

type RawScript = { name?: unknown; content?: unknown; enabled?: unknown };

/** `extensions.tavern_helper` → 背景腳本清單。認不得的形狀一律 `[]`（**不要猜**）。 */
const rawScripts = (tavernHelper: unknown): Raw[] => {
  if (tavernHelper === null || typeof tavernHelper !== 'object') return [];
  const list = (tavernHelper as { scripts?: unknown }).scripts;
  if (!Array.isArray(list)) return [];
  return (list as RawScript[])
    .filter((r) => r !== null && typeof r === 'object')
    .map((r) => ({
      name: text(r.name, '（未命名腳本）'),
      content: typeof r.content === 'string' ? r.content : '',
      enabled: r.enabled === true,
    }));
};

type RawRegex = {
  scriptName?: unknown;
  replaceString?: unknown;
  disabled?: unknown;
  promptOnly?: unknown;
};

/**
 * `extensions.regex_scripts` → **會變成畫面的那些 HTML**。
 * 🔴 `promptOnly` 的規則只作用在送回模型的版本上，永遠不會變成畫面 ——
 * 列進來只會讓同意視窗多嚇人一次，而且會讓指紋在與畫面無關的地方變動。
 */
const rawInterfaces = (regexScripts: unknown): Raw[] => {
  if (!Array.isArray(regexScripts)) return [];
  return (regexScripts as RawRegex[])
    .filter((r) => r !== null && typeof r === 'object' && r.promptOnly !== true)
    .map((r) => ({
      name: text(r.scriptName, '（未命名介面）'),
      content: typeof r.replaceString === 'string' ? r.replaceString : '',
      enabled: r.disabled !== true,
    }))
    .filter((r) => isCardInterface(r.content));
};

/** 從卡片的 `extensions.tavern_helper` 盤點出背景腳本。沒有就 `null`。 */
export function scriptsOf(tavernHelper: unknown): CardScripts | null {
  const raw = rawScripts(tavernHelper);
  if (raw.length === 0) return null;
  return { scripts: toEntries(raw, 'script'), hash: fingerprintOf(raw) };
}

/** 從 `extensions.regex_scripts` 盤點出顯示介面。 */
export const interfacesOf = (regexScripts: unknown): CardScript[] =>
  toEntries(rawInterfaces(regexScripts), 'interface');

/**
 * 🔴 **這張卡總共會執行哪些東西 —— 背景腳本 ＋ 顯示介面一起算。**
 * 同意綁的是這份合起來的指紋：只釘其中一半，另一半被換掉時不會重問。
 */
export function inventoryOf(extensions: unknown): CardScripts | null {
  const ext =
    extensions !== null && typeof extensions === 'object'
      ? (extensions as Record<string, unknown>)
      : {};
  const raw = [...rawScripts(ext['tavern_helper']), ...rawInterfaces(ext['regex_scripts'])];
  if (raw.length === 0) return null;
  const scripts = [
    ...toEntries(rawScripts(ext['tavern_helper']), 'script'),
    ...interfacesOf(ext['regex_scripts']),
  ];
  return { scripts, hash: fingerprintOf(raw) };
}

/** 這張卡總共會去哪些網域抓 code —— 同意視窗要照這個列出來問（Peter 裁定的「乙」）。 */
export const allExternals = (s: CardScripts): string[] =>
  [...new Set(s.scripts.flatMap((x) => x.externals))].sort();
