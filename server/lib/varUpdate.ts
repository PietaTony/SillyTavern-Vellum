/**
 * P2 · 變數更新協定。**沒有這個，P1／P3／P5 全是死的**（規格 §4.0）。
 *
 * 🔴 **格式不是我們發明的，是卡片自己寫在世界書裡教 LLM 的那一份**
 * （`[mvu_update]變量輸出格式`，1,398 字元）。照它實作，不照我們的想像：
 *
 *   <UpdateVariable>
 *   <Analysis>...（英文分析，80 字以內）...</Analysis>
 *   <JSONPatch>
 *   [ { "op": "delta", "path": "/安全感", "value": 2 } ]
 *   </JSONPatch>
 *   </UpdateVariable>
 *
 * ⚠️ 它說「像 RFC 6902 但支援下列 op」：`replace` / `delta` / `insert` / `remove` / `move`。
 * **`delta` 不是 RFC 6902 的**（那是這張卡的擴充），照抄標準函式庫會漏掉它。
 *
 * 🔴 **這支只做「解析與套用」，不執行卡片提供的任何轉換邏輯。**
 */

export type PatchOp =
  | { op: 'replace' | 'insert'; path: string; value: unknown }
  | { op: 'delta'; path: string; value: number }
  | { op: 'remove'; path: string }
  | { op: 'move'; path: string; from: string };

export type ParseResult = {
  analysis: string | null;
  ops: PatchOp[];
  /** 🔴 解析出了什麼問題要說出來，**不得靜默吞掉**（規格 P2 第 5 條）。 */
  problems: string[];
};

const between = (text: string, tag: string): string | null => {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i').exec(text);
  return m ? (m[1] ?? '').trim() : null;
};

const KNOWN = new Set(['replace', 'delta', 'insert', 'remove', 'move']);

/** JSON Pointer 的一段：`/安全感` → `安全感`。只支援單層與點分，不做陣列索引。 */
export const pathName = (path: string): string => path.replace(/^\//, '').split('/').join('.');

/**
 * 從一段 AI 輸出裡把更新區塊解出來。
 * 找不到 `<UpdateVariable>` 不是錯誤（大多數回覆本來就沒有）——回 `ops: []` 且 `problems` 空。
 */
export function parseUpdateBlock(text: string): ParseResult {
  const problems: string[] = [];
  const block = between(text, 'UpdateVariable');
  if (block === null) return { analysis: null, ops: [], problems };

  const analysis = between(block, 'Analysis');
  const patchRaw = between(block, 'JSONPatch');
  if (patchRaw === null) {
    problems.push('有 <UpdateVariable> 但裡面找不到 <JSONPatch>');
    return { analysis, ops: [], problems };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(patchRaw);
  } catch (e) {
    problems.push(`<JSONPatch> 不是合法 JSON：${e instanceof Error ? e.message : e}`);
    return { analysis, ops: [], problems };
  }
  if (!Array.isArray(parsed)) {
    problems.push('<JSONPatch> 必須是陣列');
    return { analysis, ops: [], problems };
  }

  const ops: PatchOp[] = [];
  for (const [i, raw] of parsed.entries()) {
    const o = raw as Record<string, unknown>;
    const op = String(o['op'] ?? '');
    const path = String(o['path'] ?? '');
    if (!KNOWN.has(op)) {
      problems.push(`第 ${i + 1} 筆的 op 不支援：${op || '(空)'}`);
      continue;
    }
    if (!path) {
      problems.push(`第 ${i + 1} 筆沒有 path`);
      continue;
    }
    if (op === 'remove') ops.push({ op: 'remove', path });
    else if (op === 'move') ops.push({ op: 'move', path, from: String(o['from'] ?? '') });
    else if (op === 'delta') {
      // 🔴 LLM 常常把數字寫成字串（格式範本裡就是 `"${delta}"`）。轉不出數字才算錯。
      const n: number = typeof o['value'] === 'number' ? o['value'] : Number(o['value']);
      if (!Number.isFinite(n)) {
        problems.push(`第 ${i + 1} 筆的 delta 不是數字：${String(o['value'])}`);
        continue;
      }
      ops.push({ op: 'delta', path, value: n });
    } else ops.push({ op: op as 'replace' | 'insert', path, value: o['value'] });
  }
  return { analysis, ops, problems };
}

/**
 * 把 ops 折成「變數名 → 打算變成的值」。**這一步還沒套約束**——
 * 約束在 `varApply.applyWithConstraints` 裡，順序是規格 P2 第 4 條規定的。
 */
export function proposalsFrom(ops: PatchOp[], current: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const o of ops) {
    const name = pathName(o.path);
    const base = name in out ? out[name] : current[name];
    if (o.op === 'delta') out[name] = (typeof base === 'number' ? base : 0) + o.value;
    else if (o.op === 'replace' || o.op === 'insert') out[name] = o.value;
    else if (o.op === 'remove') out[name] = undefined;
    else if (o.op === 'move') out[name] = current[pathName(o.from)];
  }
  return out;
}
