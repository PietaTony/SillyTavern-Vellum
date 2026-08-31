/**
 * 這支在守什麼：`docs/generated/*` 必須與正本同步，不能手改過期副本。
 *
 * 為什麼：GAP 散在 11 個 agent 檔、gate 理由散在 12 支腳本 —— 索引由
 * `gen-doc-index.ts` 生成。若只改正本不跑生成，搜尋索引會誤導 onboarding。
 *
 * 自證：pnpm exec tsx scripts/gate-doc-index.ts --selftest
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gateSummary, generatedFiles, parseAgentGaps } from './gen-doc-index.ts';

const ROOT = new URL('..', import.meta.url).pathname;

/** 可注入 root，供 `--selftest` 用 tmpdir 驗 stale／missing。 */
export function checkFreshAt(root: string, expected: Record<string, string>): string[] {
  const bad: string[] = [];
  for (const [rel, want] of Object.entries(expected)) {
    const path = join(root, rel);
    let actual: string;
    try {
      actual = readFileSync(path, 'utf8');
    } catch {
      bad.push(`${rel}: missing — run pnpm gen:doc-index`);
      continue;
    }
    if (actual !== want) bad.push(`${rel}: stale — run pnpm gen:doc-index`);
  }
  return bad;
}

export function checkFresh(): string[] {
  return checkFreshAt(ROOT, generatedFiles());
}

if (process.argv.includes('--selftest')) {
  let bad = 0;
  const fail = (name: string) => {
    console.error(`  selftest FAIL：${name}`);
    bad += 1;
  };

  const sec4 = `
## 4 · Traps

| Trap one | GAP-1 |
| Trap two | note GAP-2 and GAP-99 |
|---|---|
| Trap | Source |
| only-one-col |
| GAP-ignored | no-gap-id-here |

## 5 · Next
`;

  const gapCases: [string, () => boolean][] = [
    [
      '§4 表格抽出 GAP',
      () => {
        const rows = parseAgentGaps('chat-core', sec4);
        const ids = rows.map((r) => r.id).sort();
        return ids.join(',') === 'GAP-1,GAP-2,GAP-99';
      },
    ],
    ['缺 §4 回空', () => parseAgentGaps('x', '## 1 · no traps\n').length === 0],
    [
      'trap/source 寫進列',
      () => {
        const r = parseAgentGaps('a', sec4).find((x) => x.id === 'GAP-1');
        return r?.agent === 'a' && r.trap === 'Trap one' && r.source === 'GAP-1';
      },
    ],
  ];

  const summaryCases: [string, string, string][] = [
    ['檔頭摘要', '/**\n * 這支在守什麼：foo bar\n */', 'foo bar'],
    ['無檔頭', '// plain\n', '（無檔頭摘要）'],
  ];

  for (const [name, ok] of gapCases) {
    if (!ok()) fail(name);
  }
  for (const [name, src, want] of summaryCases) {
    if (gateSummary(src) !== want) fail(name);
  }

  const tmp = mkdtempSync(join(tmpdir(), 'gate-doc-index-'));
  try {
    const rel = 'docs/generated/test.md';
    mkdirSync(join(tmp, 'docs/generated'), { recursive: true });
    writeFileSync(join(tmp, rel), 'v1');
    if (checkFreshAt(tmp, { [rel]: 'v1' }).length !== 0) fail('fresh 一致');
    if (checkFreshAt(tmp, { [rel]: 'v2' }).length !== 1) fail('stale 抓到');
    rmSync(join(tmp, rel));
    if (checkFreshAt(tmp, { [rel]: 'v2' }).length !== 1) fail('missing 抓到');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  console.log(
    bad
      ? `selftest FAIL（${bad} 條）`
      : `selftest PASS（parseAgentGaps、gateSummary、checkFreshAt；repo fresh=${checkFresh().length === 0}）`,
  );
  process.exit(bad ? 1 : 0);
}

const bad = checkFresh();
if (bad.length) {
  console.error(`gate:doc-index FAIL:\n${bad.map((b) => `  • ${b}`).join('\n')}`);
  process.exit(1);
}
console.log('gate:doc-index OK');
