import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../services/chatModel.ts';
import type { OutputRule } from '../lib/outputRules.ts';
import { renderMessages } from '../services/renderChat.ts';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-renderchat-'));
  process.env['VELLUM_DATA'] = root;
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

/**
 * 🔴 `rulesOf`／`writeJson` 都碰檔案系統。`adapters/storage.ts` 的 `ROOT` 是**模組載入時**
 * 算一次、之後就固定住的（見那支檔頭）——如果只靠 `beforeEach` 設 `VELLUM_DATA`、卻沿用
 * 檔案最上面 `import` 進來的那份舊模組，讀寫會一直打中第一次載入當下的那個目錄
 * （通常是 `process.cwd()/data`，也就是這個 worktree 本身），不是每個測試自己的 mkdtemp
 * 目錄——**測試會綠燈，但驗到的是錯的檔案系統路徑，還會把真實資料夾寫髒**（本來就踩到過，
 * 修正前跑一次留下了 `<worktree>/data/settings.json`）。
 * ⇒ 每次都 `vi.resetModules()` 後動態 `import`，跟 `companionSettings.test.ts` 同一套。
 */
async function fresh() {
  vi.resetModules();
  const { rulesOf } = await import('../services/renderChat.ts');
  const { writeJson } = await import('../adapters/storage.ts');
  return { rulesOf, writeJson };
}

const msg = (o: Partial<Message>): Message => ({ id: 'm', role: 'model', text: '', at: 'now', ...o });
const names = { char: '何某', user: '你' };
const rule = (o: Partial<OutputRule>): OutputRule => ({
  name: 'r', find: '', replace: '', target: 'display', minDepth: null, maxDepth: null, trim: [], enabled: true, ...o,
});

describe('顯示層渲染', () => {
  it('🔴 {{user}} 要換掉 —— 使用者看到大括號只會覺得壞了', () => {
    const [m] = renderMessages([msg({ text: '{{char}}看著{{user}}' })], [], names);
    expect(m?.text).toBe('何某看著你');
  });

  it('顯示規則會套用，而且 depth 從最新一則往回算', () => {
    const rules = [rule({ find: '/開場頁/g', replace: '【首頁】', maxDepth: 0 })];
    const out = renderMessages(
      [msg({ id: 'a', text: '開場頁' }), msg({ id: 'b', text: '開場頁' })],
      rules,
      names,
    );
    // 最後一則 depth=0 才套；前面那則 depth=1 被 maxDepth 擋掉
    expect(out[0]?.text).toBe('開場頁');
    expect(out[1]?.text).toBe('【首頁】');
  });

  it('使用者自己的訊息不套規則（規則是給 AI 輸出用的）', () => {
    const rules = [rule({ find: '/我/g', replace: 'X' })];
    const [m] = renderMessages([msg({ role: 'user', text: '我說的話' })], rules, names);
    expect(m?.text).toBe('我說的話');
  });

  it('沒有規則時只做替換，不會弄壞原文', () => {
    const [m] = renderMessages([msg({ text: '純文字' })], [], names);
    expect(m?.text).toBe('純文字');
  });

  it('rulesOf 對缺欄位／壞型別都回空陣列，不丟例外（也沒有 settings.json 可讀）', async () => {
    const { rulesOf } = await fresh();
    expect(await rulesOf(null)).toEqual([]);
    expect(await rulesOf({})).toEqual([]);
    expect(await rulesOf({ outputRules: undefined })).toEqual([]);
  });

  it('D1：合併順序是「全域先、卡片後」——對齊 ST engine.js 的 SCRIPT_TYPES 順序', async () => {
    const { rulesOf, writeJson } = await fresh();
    const globalRule = rule({ name: '全域', find: '/a/g', replace: 'X' });
    await writeJson('settings.json', { globalOutputRules: [globalRule] });
    const cardRule = rule({ name: '卡片', find: '/b/g', replace: 'Y' });
    const merged = await rulesOf({ outputRules: [cardRule] });
    expect(merged.map((r) => r.name)).toEqual(['全域', '卡片']);
  });

  it('D1：卡片規則跑在全域之後，所以覆蓋同一段文字時卡片贏', async () => {
    const { rulesOf, writeJson } = await fresh();
    // 全域：把 A 換成 B；卡片：把 B 換成 C —— 依序套用的話最終結果是 C。
    await writeJson('settings.json', {
      globalOutputRules: [rule({ name: '全域', find: '/A/g', replace: 'B' })],
    });
    const cardRule = rule({ name: '卡片', find: '/B/g', replace: 'C' });
    const merged = await rulesOf({ outputRules: [cardRule] });
    const out = renderMessages([msg({ text: 'A' })], merged, names);
    expect(out[0]?.text).toBe('C');
  });

  it('D1：舊 settings.json（沒有 globalOutputRules 這個鍵）讀進來要是空陣列，不是丟例外', async () => {
    const { rulesOf, writeJson } = await fresh();
    await writeJson('settings.json', { activeProvider: 'google' });
    expect(await rulesOf({ outputRules: [rule({ name: '卡片' })] })).toEqual([
      rule({ name: '卡片' }),
    ]);
  });
});
