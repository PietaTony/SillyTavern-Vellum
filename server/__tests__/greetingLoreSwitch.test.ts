import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 🔴 **挑開場白 ＝ 切換，不是疊加**（Peter 2026-08-27 裁定 GAP-120）。
 *
 * 實測到的症狀：切過兩條線之後，開著的條目從 9 個長到 25 個 ——
 * 成年線與童年線同時開著，**互相矛盾的人生階段一起餵進 prompt**，
 * 而畫面上完全看不出來。
 *
 * ⚠️ 這個語意早就存在於線路切換器（`routes/world.ts` 的 `/lines/apply` 用 `exclusiveOff`），
 * 只是挑開場白那條路沒共用到 ⇒ **同一件事、兩個入口、兩種行為**。
 * `greetingLore.ts` 檔頭寫著「兩個入口必須是同一個引擎」，當時只共用了一半。
 *
 * 🔴 兩道護欄要一起驗，缺一條這個功能就會變成災難：
 *   · **共用的條目不關**（三條線都要的背景設定）
 *   · **沒被任何線點名的一律不動**（那是使用者自己調的）
 */
let root: string;

const G = {
  none: '沒有標籤的開場',
  a: '<!-- lore: 1,2,9 -->成年線',
  b: '<!-- lore: 3,4,9 -->童年線',
};
const GREETINGS = [G.none, G.a, G.b];

/**
 * ⚠️ **`vi.resetModules()` 不可以省。** `adapters/storage.ts` 的 ROOT 是
 * **模組載入時**從 env 算的一個常數 ⇒ 沿用上一個測試載好的那份，
 * 就會把種子寫進**上一個測試的暫存目錄**，而這一個測試看到的是空的世界書。
 * 實際踩到：第一條測試綠、後面三條紅，紅的原因跟被測物完全無關。
 */
async function seed(enabled: string[]) {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  const { writeJson } = await import('../adapters/storage.ts');
  await writeJson('characters/c.json', { id: 'c', greetings: GREETINGS });
  await writeJson('worlds/c.json', {
    characterId: 'c',
    // 9 ＝ 兩條線共用；7 ＝ 沒有任何線點名（當作「使用者自己開的」）
    entries: ['1', '2', '3', '4', '7', '9'].map((uid) => ({
      uid,
      keys: [],
      content: uid,
      enabled: enabled.includes(uid),
    })),
  });
}

const onNow = async (): Promise<string[]> => {
  process.env['VELLUM_DATA'] = root;
  const { readJson } = await import('../adapters/storage.ts');
  const w = await readJson<{ entries: { uid: string; enabled: boolean }[] } | null>('worlds/c.json', null);
  return (w?.entries ?? []).filter((e) => e.enabled).map((e) => e.uid).sort();
};

const apply = async (greeting: string) => {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  const { applyGreetingLore } = await import('../services/greetingLore.ts');
  return applyGreetingLore('c', greeting);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-lore-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('挑開場白 ＝ 切換（GAP-120）', () => {
  it('🔴 切到另一條線，上一條專屬的會被關掉 —— 不再累積', async () => {
    await seed(['7']);
    await apply(G.a);
    expect(await onNow()).toEqual(['1', '2', '7', '9']);

    const r = await apply(G.b);
    // 1、2 是成年線專屬 ⇒ 關掉；3、4 開起來
    expect(await onNow()).toEqual(['3', '4', '7', '9']);
    expect(r?.turnedOff).toEqual(['1', '2']);
  });

  it('🔴 兩條線共用的條目不關 —— 那是共同背景，關掉等於拿掉角色的基本設定', async () => {
    await seed([]);
    await apply(G.a);
    await apply(G.b);
    expect(await onNow()).toContain('9');
  });

  it('🔴 沒被任何線點名的條目一律不動 —— 那是使用者自己調的', async () => {
    await seed(['7']);
    await apply(G.a);
    expect(await onNow()).toContain('7');
    await apply(G.b);
    expect(await onNow()).toContain('7');
  });

  it('沒有標籤的開場白代表「沒有指定」，不是「全部關掉」', async () => {
    await seed(['7']);
    await apply(G.a);
    const before = await onNow();
    expect(await apply(G.none)).toBeNull();
    expect(await onNow()).toEqual(before);
  });

  it('turnedOff 要回報出來 —— 靜靜關掉別人的設定是最貴的那種缺陷', async () => {
    await seed([]);
    await apply(G.a);
    const r = await apply(G.b);
    expect(r?.turnedOff).toEqual(['1', '2']);
    expect(r?.include).toEqual(['3', '4', '9']);
  });
});
