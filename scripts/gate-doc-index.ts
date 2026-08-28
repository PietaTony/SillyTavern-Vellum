/**
 * 這支在守什麼：`docs/generated/*` 必須與正本同步，不能手改過期副本。
 *
 * 為什麼：GAP 散在 11 個 agent 檔、gate 理由散在 12 支腳本 —— 索引由
 * `gen-doc-index.ts` 生成。若只改正本不跑生成，搜尋索引會誤導 onboarding。
 *
 * 自證：pnpm exec tsx scripts/gate-doc-index.ts --selftest
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generatedFiles } from './gen-doc-index.ts';

const ROOT = new URL('..', import.meta.url).pathname;

export function checkFresh(): string[] {
  const bad: string[] = [];
  for (const [rel, expected] of Object.entries(generatedFiles())) {
    const path = join(ROOT, rel);
    let actual: string;
    try {
      actual = readFileSync(path, 'utf8');
    } catch {
      bad.push(`${rel}: missing — run pnpm gen:doc-index`);
      continue;
    }
    if (actual !== expected) bad.push(`${rel}: stale — run pnpm gen:doc-index`);
  }
  return bad;
}

if (process.argv.includes('--selftest')) {
  const fresh = checkFresh().length === 0;
  const hasGap = generatedFiles()['docs/generated/gap-index.md'].includes('GAP-37');
  const hasGate = generatedFiles()['docs/generated/gate-index.md'].includes('gate-boundaries');
  const ok = hasGap && hasGate;
  if (!ok) {
    console.error('gate-doc-index selftest FAIL');
    process.exit(1);
  }
  console.log(`gate-doc-index selftest OK (fresh=${fresh})`);
  process.exit(0);
}

const bad = checkFresh();
if (bad.length) {
  console.error(`gate:doc-index FAIL:\n${bad.map((b) => `  • ${b}`).join('\n')}`);
  process.exit(1);
}
console.log('gate:doc-index OK');
