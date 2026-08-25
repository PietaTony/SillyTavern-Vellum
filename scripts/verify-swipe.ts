/**
 * B3 驗收：**開場白切換時，世界書條目的開關真的跟著變。**
 *
 *   VELLUM_CARD=/path/card.png pnpm verify:swipe
 *
 * 🔴 這條在此之前**驗不了**——不是因為引擎沒做，是因為**沒有任何動作可以觸發它**。
 * B5 提取器與 P4 規則早就好了，但沒有 swipe 就沒有「切換」這個事件。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CharWorld } from '../server/lib/charWorld.ts';

const PORT = 8595;
const base = `http://127.0.0.1:${PORT}`;
const cardPath = process.env['VELLUM_CARD'];
if (!cardPath) {
  console.error('請指定卡片：VELLUM_CARD=/path/card.png pnpm verify:swipe');
  process.exit(2);
}
const dataDir = mkdtempSync(join(tmpdir(), 'vellum-swipe-'));
const server = spawn('pnpm', ['exec', 'tsx', 'server/index.ts'], {
  env: { ...process.env, PORT: String(PORT), VELLUM_DATA: dataDir, NODE_ENV: 'development' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
const stop = (code: number): never => {
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
  process.exit(code);
};
const fail = (why: string): never => {
  console.error(`FAIL — ${why}`);
  return stop(1);
};
for (let i = 0; i < 60; i += 1) {
  try {
    if ((await fetch(`${base}/api/version`)).ok) break;
  } catch {
    /* 還沒起來 */
  }
  await new Promise((r) => setTimeout(r, 250));
}

const imported = (await (
  await fetch(`${base}/api/characters/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array(readFileSync(cardPath)),
  })
).json()) as { id: string; greetings?: string[] };
const greetings = imported.greetings ?? [];
console.log(`開場白：${greetings.length} 則`);

const enabledSet = async (): Promise<Set<string>> => {
  const w = (await (
    await fetch(`${base}/api/characters/${imported.id}/world`)
  ).json()) as CharWorld;
  return new Set(w.entries.filter((e) => e.enabled).map((e) => e.uid));
};

const factory = await enabledSet();
type Lore = { include: string[]; exclude: string[]; changed: number; dangling: string[] } | null;

const chat = (await (
  await fetch(`${base}/api/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId: imported.id, greetingIndex: 1 }),
  })
).json()) as { id: string; messages: { id: string; swipes?: string[] }[]; lore: Lore };
const first = chat.messages[0];
const afterFirst = await enabledSet();
console.log(
  `選第 2 則開場 → lore ${JSON.stringify(chat.lore?.include ?? [])}｜改動 ${chat.lore?.changed ?? 0} 條`,
);
console.log(`  啟用條目：出廠 ${factory.size} → ${afterFirst.size}`);

if (!first) fail('對話沒有開場訊息');
if ((first?.swipes?.length ?? 0) !== greetings.length)
  fail(`開場訊息的候選數 ${first?.swipes?.length} ≠ 開場白數 ${greetings.length}`);

// 切到第 5 則（實測第 1–3 則與第 4–6 則的標籤組不同）
const swiped = (await (
  await fetch(`${base}/api/chats/${chat.id}/messages/${first?.id}/swipe`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index: 4 }),
  })
).json()) as { swipeIndex: number; text: string; lore: Lore };
const afterSwipe = await enabledSet();
console.log(
  `切到第 5 則 → lore ${JSON.stringify(swiped.lore?.include ?? [])}｜改動 ${swiped.lore?.changed ?? 0} 條`,
);
console.log(`  啟用條目：${afterFirst.size} → ${afterSwipe.size}`);

const diff = [...afterSwipe]
  .filter((u) => !afterFirst.has(u))
  .concat([...afterFirst].filter((u) => !afterSwipe.has(u)));
console.log(`  兩次之間有 ${diff.length} 條的開關不同：${diff.slice(0, 12).join(' ')}`);
console.log(`  訊息文字：${first?.swipes?.[1]?.slice(0, 0)}${swiped.text.slice(0, 24)}⋯（已切換）`);

if (greetings.length < 2) fail('這張卡只有一則開場白，B3 驗不了');
const lore0 = chat.lore;
if (!lore0) fail('選開場白沒有套用 lore 標籤');
if ((lore0?.dangling.length ?? 0) > 0)
  fail(`lore 標籤指到不存在的條目：${lore0?.dangling.join(',')}`);
if (swiped.swipeIndex !== 4) fail('swipe 沒有切到指定的候選');
if (swiped.text === '') fail('切換後訊息內容是空的');
if (diff.length === 0) fail('🔴 B3：切換開場白之後世界書開關完全沒變 —— 這條鏈沒有接上');
console.log('verify:swipe PASS — B3 開場白切換 → 標籤提取 → 世界書開關真的跟著變');
stop(0);
