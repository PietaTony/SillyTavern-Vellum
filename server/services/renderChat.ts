/**
 * 把對話「渲染成給人看的樣子」。
 *
 * 🔴 **P6 的引擎早就做好了，但在此之前沒有任何地方呼叫它** —— 於是卡片的狀態欄
 * `<思年>…</思年>` 與變數更新區塊 `<UpdateVariable><JSONPatch>…` 原封顯示給使用者看。
 * **「引擎有了、沒有門」的同一個病，只是低一層。**
 *
 * 🔴 **存的是原文，渲染是讀取時才做。** 反過來（存渲染後的）會讓
 * 「送回模型的版本」永遠拿不回原文——而那兩個版本本來就該不同（規格 P6 的核心語意）。
 *
 * 🔴 **M13 第一期起這裡只套規則與巨集，不再把 HTML 壓成文字。**
 * 顯示層（markdown／淨化／要不要渲染）全部歸前端 —— 見 `src/features/chat/render/`。
 */
import type { Message } from './chatModel.ts';
import { substitute } from '../lib/macro.ts';
import { applyRules, type OutputRule } from '../lib/outputRules.ts';
import { loadSettings } from './settings.ts';

/**
 * 深度＝從最新一則往回數（`maxDepth=2` 的開場頁靠它生效）。
 *
 * 🔴 **顯示（這支）與送進模型（`buildTurn.ts`）共用同一套算法**（D1 擴充，
 * Peter 2026-08-31）——同一條 `minDepth`／`maxDepth` 規則，兩條路徑算出的深度只要
 * 有一絲不同，就會套用在不同的幾則訊息上；而使用者只看得到顯示那邊，
 * prompt 那邊算錯了不會有任何畫面告訴他。**改這支一定要同時檢查 `buildTurn.ts` 的呼叫端。**
 */
export const depthFromEnd = (index: number, total: number): number => total - 1 - index;

export function renderMessages(
  messages: Message[],
  rules: OutputRule[],
  names: { char: string; user: string },
): Message[] {
  return messages.map((m, i) => {
    if (m.role !== 'model') return m;
    const depth = depthFromEnd(i, messages.length);
    const ruled = rules.length ? applyRules(m.text, rules, { target: 'display', depth }) : m.text;
    // 🔴 `{{user}}` 沒替換掉會直接印在畫面上 —— 使用者看到大括號只會覺得壞了。
    /**
     * 🔴 **M13 第一期起不再壓平成純文字。**
     * 上一版這裡是 `substitute(htmlToText(ruled), …)` —— 那是「等 UI 對齊（U7）」的過渡措施，
     * 代價是卡片的狀態欄、表格、粗體全部被剝成一片字。現在前端會渲染 HTML（`render/html.ts`
     * 的 markdown ＋ DOMPurify），**壓平的工作連同 `htmlToText` 一起搬去前端**
     * （`src/features/chat/render/plain.ts` 的 `toPlainText`，只剩對話清單的預覽字在用）。
     * ⚠️ **後端仍然只送「顯示版」，原文留在檔案裡**（送回模型的版本要用原文）——這條沒變。
     */
    const named = substitute(ruled, names, { missing: 'keep' });
    return named === m.text ? m : { ...m, text: named };
  });
}

/**
 * 這段對話真正要套用的規則表 —— **兩個來源的合併**（D1，Peter 2026-08-31 跨層票）。
 * ① 卡片內嵌（`c.outputRules`，來自 `extensions.regex_scripts` → `deriveConfig.ts`）
 * ② 使用者自己建的（`settings.json` 的 `globalOutputRules`，**全域、不綁角色** ——
 *    綁角色會把使用者的個人規則寫進卡片檔，匯出卡片時一起帶走，那可能是他不想分享的東西）。
 *
 * 🔴 **順序：全域先、卡片後 —— 這是查證過的 ST 行為，不是我們自己選的。**
 * `SillyTavern-Reference/public/scripts/extensions/regex/engine.js:11-16`：
 * `SCRIPT_TYPES = { GLOBAL: 0, SCOPED: 1, PRESET: 2 }`，註解寫死
 * `// ORDER MATTERS: defines the regex script priority`；`getRegexScripts()` 用這個順序
 * `flatMap`——GLOBAL（我們的「使用者自建」）永遠排在 SCOPED（我們的「卡片內嵌」）前面。
 *
 * `applyRules` 是**依序套用、後一條吃前一條的輸出**（`outputRules.ts` 檔頭）——
 * 順序不只是「誰先跑」，是「誰的輸出是最終結果」。全域先跑、卡片後跑 ⇒ **卡片作者的規則
 * 有最後一擊**：使用者的通用規則（例如「所有 OOC 都拿掉」）先清過一輪，卡片自己認得的格式
 * （它自己的狀態欄、它自己的標記）最後再精修一次，不會被使用者寫的一條通用規則意外吃掉。
 *
 * 🔴 **兩條路徑共用這一支**，不要各寫一份合併邏輯（Peter 2026-08-31 補的裁定：
 * 這個 repo 已經有三次「同一個坑、多條平行路徑，只補了一條」）——
 * `renderMessages`（這支檔案）套 `target: 'display'`／`'both'` 進畫面；
 * `services/buildTurn.ts` 用同一份合併結果套 `target: 'prompt'`／`'both'` 進送給模型的文字。
 * 合併的優先序（誰先跑、誰有最後一擊）兩邊完全相同，因為兩邊拿到的是同一個陣列。
 *
 * 🔴 **async**：要讀 `settings.json` 才知道使用者自建了哪些規則。唯一呼叫端
 * （`routes/chats.ts` 的 `GET /:id`）已經是 `async` handler，多一個 `await` 不改變它是否寫檔——
 * `loadSettings()` 只讀不寫（`adapters/storage.ts` 的 `readJson`），GET 仍然不動 `settings.json`。
 */
export async function rulesOf(c: { outputRules?: unknown[] | undefined } | null): Promise<OutputRule[]> {
  const card = Array.isArray(c?.outputRules) ? (c.outputRules as OutputRule[]) : [];
  const global = (await loadSettings()).globalOutputRules;
  return [...(Array.isArray(global) ? (global as OutputRule[]) : []), ...card];
}
