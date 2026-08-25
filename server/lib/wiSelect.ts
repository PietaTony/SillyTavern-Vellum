/**
 * 世界書三步的**第一步：選**。哪些 entry 這一輪要進場。
 *
 * 語意對齊 ST `world-info.js:4689-4866`。順序是刻意的：
 *   停用 → 略過｜`constant` → **直接進場，完全不比對關鍵字**（:4781）｜
 *   否則比 primary key → 有 secondary 就再比 `selectiveLogic` → 最後擲骰
 *
 * 🔴 **回報「為什麼沒進場」，不要只回進場的那些。**
 * 只回 activated 的話，「38 條掃出 0 條」與「根本沒讀到世界書」在輸出上長得一模一樣。
 */
import type { WbEntry } from './worldbook.ts';
import { matchAny, secondaryOk } from './wiMatch.ts';

export type SkipReason = 'disabled' | 'no-key' | 'no-primary' | 'secondary' | 'probability';

export type Selection = {
  activated: WbEntry[];
  skipped: { entry: WbEntry; why: SkipReason }[];
  /** 掃描字串的長度。🔴 0 代表尺沒讀到東西，不是「沒有東西命中」。 */
  scanned: number;
};

export type ScanMessage = { name: string; text: string };

/**
 * 組出要被掃描的文字。ST 的來源是 `chat` 陣列**由新到舊** slice `scanDepth` 則
 * （`script.js:4565`），含使用者訊息，`world_info_include_names` 開時前綴說話者名字。
 */
export function buildScanText(messages: ScanMessage[], depth: number, includeNames = true): string {
  return messages
    .slice(-Math.max(0, depth))
    .reverse()
    .map((m) => (includeNames && m.name ? `${m.name}: ${m.text}` : m.text))
    .join('\n');
}

/** 擲骰預設用 `Math.random`，測試時可注入固定值 —— 不可測的骰子等於不可測的引擎。 */
export type SelectOpts = { roll?: () => number };

export function selectEntries(entries: WbEntry[], scanText: string, opts: SelectOpts = {}): Selection {
  const roll = opts.roll ?? (() => Math.random() * 100);
  const activated: WbEntry[] = [];
  const skipped: Selection['skipped'] = [];
  const push = (entry: WbEntry, why: SkipReason) => skipped.push({ entry, why });

  for (const e of entries) {
    if (!e.enabled) {
      push(e, 'disabled');
      continue;
    }
    const o = { caseSensitive: e.caseSensitive, matchWholeWords: e.matchWholeWords };
    if (!e.constant) {
      if (e.keys.length === 0) {
        // 不是 constant 又沒有 key ⇒ 永遠不會被觸發。ST 的行為也是這樣，
        // 但這種條目通常是設定錯誤，所以獨立一個原因回報出去。
        push(e, 'no-key');
        continue;
      }
      if (!matchAny(scanText, e.keys, o)) {
        push(e, 'no-primary');
        continue;
      }
      if (e.selective && !secondaryOk(scanText, e.secondaryKeys, e.selectiveLogic, o)) {
        push(e, 'secondary');
        continue;
      }
    }
    // 🔴 `probability === 100` 時 ST 直接放行、**不擲骰**（:4911）。
    // 照擲的話會讓「100% 也可能不中」，而卡片作者是靠這個當「一定進場」用的。
    if (e.useProbability && e.probability !== 100 && roll() > e.probability) {
      push(e, 'probability');
      continue;
    }
    activated.push(e);
  }
  return { activated, skipped, scanned: scanText.length };
}

/** 把 skipped 收成「原因 → 幾條」，回報涵蓋率用。 */
export function tallySkips(s: Selection): Record<SkipReason, number> {
  const t = { disabled: 0, 'no-key': 0, 'no-primary': 0, secondary: 0, probability: 0 };
  for (const x of s.skipped) t[x.why] += 1;
  return t;
}
