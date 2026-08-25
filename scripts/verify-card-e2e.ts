/**
 * 🔴 **A1 的真正驗收：穿過儲存層與 HTTP。**
 *
 * `verify:card` 只證明「編碼再解碼是可逆的」——那是在記憶體裡打轉，
 * **從來沒有真的存進磁碟、也沒有經過 route**。這支才是被測物本體：
 *
 *   起 server（用臨時資料目錄）→ POST 真卡 → GET 匯出 → 逐欄位比對
 *
 *   VELLUM_CARD=/path/to/card.png pnpm verify:card:e2e
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCard } from '../server/lib/card.ts';
import { parseChatJsonl, viewOfEntry } from '../server/lib/chatFile.ts';
import { type Diff, deepDiff } from './deep-diff.ts';

const MIN_LEAVES = 100;
const PORT = 8597;
const base = `http://127.0.0.1:${PORT}`;

const src = process.env['VELLUM_CARD'];
if (!src) {
  console.error('請指定卡片：VELLUM_CARD=/path/to/card.png pnpm verify:card:e2e');
  process.exit(2);
}

const dataDir = mkdtempSync(join(tmpdir(), 'vellum-e2e-'));
const server = spawn('pnpm', ['exec', 'tsx', 'server/index.ts'], {
  env: { ...process.env, PORT: String(PORT), VELLUM_DATA: dataDir, NODE_ENV: 'development' },
  stdio: ['ignore', 'ignore', 'inherit'],
});

const stop = (code: number): never => {
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
  process.exit(code);
};

async function waitUp(): Promise<void> {
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(`${base}/api/version`);
      if (r.ok) return;
    } catch {
      // 還沒起來
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  console.error('FAIL — server 起不來');
  stop(1);
}

await waitUp();

const png = readFileSync(src);
const up = await fetch(`${base}/api/characters/import`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/octet-stream' },
  body: new Uint8Array(png),
});
if (!up.ok) {
  console.error(`FAIL — 匯入回 ${up.status}：${await up.text()}`);
  stop(1);
}
const created = (await up.json()) as { id: string; name: string; alternateGreetings: number };

const down = await fetch(`${base}/api/characters/${created.id}/card.png`);
if (!down.ok) {
  console.error(`FAIL — 匯出回 ${down.status}`);
  stop(1);
}
const out = Buffer.from(await down.arrayBuffer());

const a = readCard(png);
const b = readCard(out);
let leaves = 0;
const diffs: Diff[] = [];
for (const kw of Object.keys(a.payloads) as (keyof typeof a.payloads)[]) {
  const r = deepDiff(a.payloads[kw], b.payloads[kw], `${kw}`);
  leaves += r.leaves;
  diffs.push(...r.out);
}

console.log(`卡片 ${src}（${png.length} bytes）`);
console.log(
  `  匯入 → 角色 ${created.name}（id ${created.id}）｜額外問候 ${created.alternateGreetings} 則`,
);
console.log(`  匯出 → ${out.length} bytes｜payload：${Object.keys(b.payloads).join('／')}`);
console.log(`  比對葉節點：${leaves}（門檻 ${MIN_LEAVES}）｜差異：${diffs.length}`);

if (leaves < MIN_LEAVES) {
  console.error(`FAIL — 只比對到 ${leaves} 個葉節點。這是「尺沒讀到東西」，不是「沒有差異」。`);
  stop(1);
}
if (diffs.length) {
  for (const d of diffs.slice(0, 20)) console.error(`  差異 ${d.path}`);
  stop(1);
}
/**
 * 對話檔同一條路徑再走一次。**這是「完整匯入這個角色」的另一半**——
 * 卡片進來了但對話沒進來，對使用者來說仍然是「我的東西不見了」。
 */
const chatSrc = process.env['VELLUM_CHAT'];
if (chatSrc) {
  const text = readFileSync(chatSrc, 'utf8');
  const upC = await fetch(`${base}/api/chats/import?characterId=${created.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: text,
  });
  if (!upC.ok) {
    console.error(`FAIL — 對話匯入回 ${upC.status}：${await upC.text()}`);
    stop(1);
  }
  const chat = (await upC.json()) as { id: string; messages: unknown[]; swipeCounts: number[] };
  const downC = await fetch(`${base}/api/chats/${chat.id}/export.jsonl`);
  if (!downC.ok) {
    console.error(`FAIL — 對話匯出回 ${downC.status}`);
    stop(1);
  }
  const src0 = parseChatJsonl(text);
  const back = parseChatJsonl(await downC.text());
  let keys = 0;
  const bad: string[] = [];
  if (src0.entries.length !== back.entries.length)
    bad.push(`訊息數 ${src0.entries.length} → ${back.entries.length}`);
  if (JSON.stringify(src0.header) !== JSON.stringify(back.header)) bad.push('header 不同');
  keys += Object.keys(src0.header).length;
  for (const [i, row] of src0.entries.entries()) {
    keys += Object.keys(row).length;
    if (JSON.stringify(row) !== JSON.stringify(back.entries[i])) bad.push(`第 ${i + 1} 則不同`);
  }
  const swipes = src0.entries.map((e) => viewOfEntry(e).swipes.length);
  console.log(`對話 ${chatSrc}`);
  console.log(`  匯入 → ${chat.messages.length} 則｜swipe 數 [${chat.swipeCounts.join(', ')}]`);
  console.log(`  匯出 → ${back.entries.length} 則｜比對頂層鍵 ${keys} 個｜差異 ${bad.length}`);
  if (src0.entries.length === 0) {
    console.error('FAIL — 0 則訊息。尺沒讀到東西。');
    stop(1);
  }
  if (JSON.stringify(swipes) !== JSON.stringify(chat.swipeCounts)) {
    console.error(
      `FAIL — swipes 沒保住：來源 [${swipes.join(', ')}]，匯入後 [${chat.swipeCounts.join(', ')}]`,
    );
    stop(1);
  }
  if (bad.length) {
    for (const d of bad.slice(0, 20)) console.error(`  差異 ${d}`);
    stop(1);
  }
}

console.log('verify:card:e2e PASS — 真卡與真對話穿過 HTTP 與儲存層，匯入→匯出無資訊遺失');
stop(0);
