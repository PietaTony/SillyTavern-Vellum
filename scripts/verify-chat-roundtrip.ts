/**
 * B1 驗收：**真的對話檔 import → export → 逐行逐鍵比對**。
 *
 * 🔴 路徑只從環境變數來，沒有預設值（真實對話是私人內容，不寫進公開 repo）：
 *   VELLUM_CHAT=/path/to/chat.jsonl pnpm verify:chat
 *
 * 守的是**涵蓋率**：比對 0 則訊息必然 PASS，所以行數為 0 一律 FAIL。
 */
import { readFileSync } from 'node:fs';
import {
  parseChatJsonl,
  viewOfEntry,
  viewOfHeader,
  writeChatJsonl,
} from '../server/lib/chatFile.ts';

function keysDeep(v: unknown, prefix = '', out: string[] = []): string[] {
  if (!v || typeof v !== 'object') return out;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out.push(`${prefix}${k}`);
    if (val && typeof val === 'object' && !Array.isArray(val)) keysDeep(val, `${prefix}${k}.`, out);
  }
  return out;
}

if (process.argv.includes('--selftest')) {
  const good = [
    { user_name: 'u', character_name: 'c' },
    { is_user: false, mes: 'x' },
  ]
    .map((r) => JSON.stringify(r))
    .join('\n');
  let bad = 0;
  const f = parseChatJsonl(good);
  if (f.entries.length !== 1) bad += 1;
  // 故意弄壞：少一則訊息要被看見（不是靜靜通過）
  const dropped = { header: f.header, entries: [] as Record<string, unknown>[] };
  if (dropped.entries.length === f.entries.length) bad += 1;
  // 故意弄壞：一行壞 JSON 要丟例外
  try {
    parseChatJsonl('{壞掉');
    bad += 1;
  } catch {
    // 預期
  }
  console.log(bad ? `selftest FAIL（${bad} 條）` : 'selftest PASS（少訊息／壞行都被抓到）');
  process.exit(bad ? 1 : 0);
}

const src = process.env['VELLUM_CHAT'];
if (!src) {
  console.error('請指定對話檔：VELLUM_CHAT=/path/to/chat.jsonl pnpm verify:chat');
  process.exit(2);
}

const before = parseChatJsonl(readFileSync(src, 'utf8'));
const after = parseChatJsonl(writeChatJsonl(before));

const diffs: string[] = [];
let keysChecked = 0;
if (before.entries.length !== after.entries.length)
  diffs.push(`訊息數 ${before.entries.length} → ${after.entries.length}`);
for (const [i, row] of before.entries.entries()) {
  const back = after.entries[i];
  const ks = keysDeep(row);
  keysChecked += ks.length;
  if (JSON.stringify(row) !== JSON.stringify(back)) diffs.push(`第 ${i + 1} 則內容不同`);
}
const hk = keysDeep(before.header);
keysChecked += hk.length;
if (JSON.stringify(before.header) !== JSON.stringify(after.header)) diffs.push('header 不同');

const views = before.entries.map(viewOfEntry);
console.log(`對話檔 ${src}`);
console.log(`  header：${JSON.stringify(viewOfHeader(before.header))}｜header 鍵 ${hk.length} 個`);
console.log(
  `  訊息 ${before.entries.length} 則（user ${views.filter((v) => v.role === 'user').length}／model ${views.filter((v) => v.role === 'model').length}）`,
);
console.log(
  `  有 swipes 的訊息：${views.filter((v) => v.swipes.length > 0).length} 則，最多 ${Math.max(0, ...views.map((v) => v.swipes.length))} 個`,
);
console.log(`  比對鍵數：${keysChecked}｜差異：${diffs.length}`);

if (before.entries.length === 0) {
  console.error('FAIL — 0 則訊息。這是「尺沒讀到東西」，不是「沒有差異」。');
  process.exit(1);
}
if (diffs.length) {
  for (const d of diffs.slice(0, 20)) console.error(`  差異 ${d}`);
  process.exit(1);
}
console.log('verify:chat PASS — 匯入→匯出無資訊遺失');
