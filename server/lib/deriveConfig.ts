/**
 * 從卡片**機械地**推出一份 Vellum 原生設定的起點。
 *
 * 🔴 **只推「機械上讀得出來」的東西**，讀不出來的留空由人補——
 * 猜出來的設定看起來跟查證過的一模一樣，那是最貴的一種錯。
 *
 * 目前推得出來的兩樣：
 *   ① 變數初值：世界書 `[initvar]` 條目，形狀是 `名: 值` 一行一個
 *   ② 輸出規則：`extensions.regex_scripts`（12 條，已在 `outputRules.ts` 對齊 ST 語意）
 */
import { fromRegexScripts } from './outputRules.ts';
import type { VellumConfig } from './vellumConfig.ts';
import type { VarDef } from './vars.ts';
import { fromCharacterBook } from './worldbook.ts';

type Bag = Record<string, unknown>;
const bag = (v: unknown): Bag => (v && typeof v === 'object' ? (v as Bag) : {});

/** `[initvar]` 那條的正文：`時期: 成年` / `安全感: 15`。回傳變數定義。 */
export function parseInitVars(content: string): VarDef[] {
  const out: VarDef[] = [];
  for (const line of content.split('\n')) {
    const m = /^\s*([^\s#:][^:]*?)\s*[:：]\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const name = (m[1] ?? '').trim();
    const raw = (m[2] ?? '').trim();
    if (!name || name.startsWith('#')) continue;
    const n = Number(raw);
    out.push(
      Number.isFinite(n) && raw !== ''
        ? { name, type: 'number', initial: n }
        : { name, type: 'string', initial: raw },
    );
  }
  return out;
}

/** 從卡片推出設定起點。`found` 說明每一項是從哪裡來的 —— 沒有出處的欄位不要信。 */
export function deriveConfig(cardJson: unknown): { config: VellumConfig; found: Record<string, string> } {
  const data = bag(bag(cardJson)['data']);
  const ext = bag(data['extensions']);
  const found: Record<string, string> = {};

  const book = fromCharacterBook(data['character_book']);
  const initEntry = book.find((e) => /initvar/i.test(e.comment));
  const variables = initEntry ? parseInitVars(initEntry.content) : [];
  found['variables'] = initEntry ? `character_book「${initEntry.comment}」` : '（找不到 [initvar] 條目）';

  const outputRules = fromRegexScripts(ext['regex_scripts']);
  found['outputRules'] = `extensions.regex_scripts（${outputRules.length} 條）`;

  return {
    config: { version: 1, variables, derived: [], constraints: [], outputRules },
    found,
  };
}
