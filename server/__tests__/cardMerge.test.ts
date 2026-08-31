import { describe, expect, it } from 'vitest';
import type { Card } from '../lib/card.ts';
import { mergeOwned, mergeWorldToggles } from '../lib/cardMerge.ts';

/**
 * 🔴 **這支守的是本專案的最高契約：無資訊遺失**（規格 §7 A1／A2）。
 * 判準**不是位元組相等** —— 鍵序可以變、PNG 可以重編碼，**但一個欄位都不准掉**。
 *
 * 背景（GAP-66）：我們的編輯只寫 `characters/<id>.json`，匯出卻是從 PNG 重建
 * ⇒ 使用者改過的東西匯出後會消失。合併回去是對的，但**合併本身就是最容易弄丟東西的動作**
 * （memory `正規化寫回＝資料損毀`：只准寫你擁有的鍵）。
 */
const OWNED = {
  description: '新的描述',
  firstMessage: '新的開場',
  alternateGreetings: ['alt1', 'alt2'],
};

describe('mergeOwned', () => {
  it('🔴 V3（欄位在 `data` 底下）：只改三個鍵，其餘原樣', () => {
    const card: Card = {
      primary: 'ccv3',
      payloads: {
        ccv3: {
          spec: 'chara_card_v3',
          data: {
            name: '測試卡A',
            description: '舊的',
            first_mes: '舊開場',
            alternate_greetings: ['舊 alt'],
            // 🔴 這些是「我們還沒實作」的欄位 —— 一個都不准掉
            character_book: { entries: [{ keys: ['醫院'] }] },
            extensions: { regex_scripts: [{ scriptName: 'x' }], depth_prompt: { depth: 4 } },
            tags: ['醫生', '銀髮'],
          },
        },
      },
    };
    const out = mergeOwned(card, OWNED) as { payloads: { ccv3: { data: Record<string, unknown> } } };
    const d = out.payloads.ccv3.data;
    expect(d['description']).toBe('新的描述');
    expect(d['first_mes']).toBe('新的開場');
    expect(d['alternate_greetings']).toEqual(['alt1', 'alt2']);
    // 🔴 `name` **不可以被改** —— 改名寫 displayName，永不寫回卡片（D-h）
    expect(d['name']).toBe('測試卡A');
    expect(d['character_book']).toEqual({ entries: [{ keys: ['醫院'] }] });
    expect(d['extensions']).toEqual({
      regex_scripts: [{ scriptName: 'x' }],
      depth_prompt: { depth: 4 },
    });
    expect(d['tags']).toEqual(['醫生', '銀髮']);
    // 守涵蓋率：鍵的數量不可以變（沒有多也沒有少）
    expect(Object.keys(d).sort()).toEqual(
      ['alternate_greetings', 'character_book', 'description', 'extensions', 'first_mes', 'name', 'tags'].sort(),
    );
  });

  it('🔴 V2（欄位在 top-level）：要寫回 top-level，不可以偷偷搬進 `data`', () => {
    const card: Card = {
      primary: 'chara',
      payloads: {
        chara: { name: 'X', description: '舊的', first_mes: '舊開場', creator: '某人' },
      },
    };
    const out = mergeOwned(card, OWNED) as { payloads: { chara: Record<string, unknown> } };
    const p = out.payloads.chara;
    expect(p['description']).toBe('新的描述');
    expect(p['first_mes']).toBe('新的開場');
    expect(p['creator']).toBe('某人');
    expect(p['data']).toBeUndefined();
    // 卡裡本來沒有 alternate_greetings ⇒ 補在 top-level（與其他欄位同一層）
    expect(p['alternate_greetings']).toEqual(['alt1', 'alt2']);
  });

  it('🔴 兩份 payload 都要寫（只寫一份會讓 chara 與 ccv3 分岔）', () => {
    const card: Card = {
      primary: 'ccv3',
      payloads: {
        ccv3: { data: { description: '舊' } },
        chara: { description: '舊' },
      },
    };
    const out = mergeOwned(card, OWNED) as {
      payloads: { ccv3: { data: Record<string, unknown> }; chara: Record<string, unknown> };
    };
    expect(out.payloads.ccv3.data['description']).toBe('新的描述');
    expect(out.payloads.chara['description']).toBe('新的描述');
  });

  it('不是物件的 payload 原樣退回（不知道那是什麼就不要猜著改）', () => {
    const card: Card = { primary: 'chara', payloads: { chara: '這不是物件' } };
    expect(mergeOwned(card, OWNED).payloads.chara).toBe('這不是物件');
  });

  it('沒有的那一份不會被憑空造出來', () => {
    const card: Card = { primary: 'chara', payloads: { chara: { description: '舊' } } };
    expect(Object.keys(mergeOwned(card, OWNED).payloads)).toEqual(['chara']);
  });
});

/**
 * 🔴 A4：世界書條目的開／關要能合併回 `character_book`（GAP-66 同一個坑的第二條路徑）。
 * 判準跟 `mergeOwned` 一樣是「無資訊遺失」——這裡額外守的是**只碰 `enabled`**：
 * `extensions`、`content`、`keys`……一個字都不能動，連「被改動的那一條」自己的
 * 其他欄位也不行。
 */
describe('mergeWorldToggles', () => {
  const book = {
    entries: [
      { id: 0, keys: ['甲'], content: '甲的內容', enabled: true, extensions: { probability: 100 } },
      { id: 1, keys: ['乙'], content: '乙的內容', enabled: true, extensions: { probability: 50 } },
      { keys: ['丙，沒有 id'], content: '丙的內容', enabled: false }, // uid 靠陣列索引（2）
    ],
  };

  it('🔴 只關掉使用者關掉的那一條，其餘條目逐位元組不變', () => {
    const card: Card = {
      primary: 'ccv3',
      payloads: { ccv3: { data: { name: 'X', character_book: book, extensions: { regex_scripts: [{ x: 1 }] } } } },
    };
    const out = mergeWorldToggles(card, [
      { uid: '0', enabled: false }, // 甲：關掉
      { uid: '1', enabled: true }, // 乙：本來就開著，不該被動到
      { uid: '2', enabled: false }, // 丙：本來就是關的，不該被動到
    ]) as { payloads: { ccv3: { data: Record<string, unknown> } } };
    const d = out.payloads.ccv3.data;
    const entries = (d['character_book'] as { entries: Record<string, unknown>[] }).entries;
    expect(entries[0]).toEqual({ ...book.entries[0], enabled: false });
    // 沒被動到的兩條：連物件參照都該是同一個（沒被重新序列化）
    expect(entries[1]).toBe(book.entries[1]);
    expect(entries[2]).toBe(book.entries[2]);
    // 世界書以外的東西（`extensions.regex_scripts`）原樣留著
    expect(d['extensions']).toEqual({ regex_scripts: [{ x: 1 }] });
  });

  it('V2（`character_book` 在 top-level）：寫回 top-level，不可以偷偷搬進 `data`', () => {
    const card: Card = { primary: 'chara', payloads: { chara: { name: 'X', character_book: book } } };
    const out = mergeWorldToggles(card, [{ uid: '0', enabled: false }]) as {
      payloads: { chara: Record<string, unknown> };
    };
    expect(out.payloads.chara['data']).toBeUndefined();
    const entries = (out.payloads.chara['character_book'] as { entries: Record<string, unknown>[] }).entries;
    expect(entries[0]).toEqual({ ...book.entries[0], enabled: false });
  });

  it('沒對上任何 uid 的開關列表 ＝ 整份 payload 原封不動（同一個物件參照）', () => {
    const card: Card = { primary: 'chara', payloads: { chara: { name: 'X', character_book: book } } };
    const out = mergeWorldToggles(card, [{ uid: '99', enabled: false }]);
    expect(out.payloads.chara).toBe(card.payloads.chara);
  });

  it('沒有 character_book 的卡：原樣退回，不會憑空生出一個', () => {
    const card: Card = { primary: 'chara', payloads: { chara: { name: 'X', description: '舊' } } };
    const out = mergeWorldToggles(card, [{ uid: '0', enabled: false }]);
    expect(out.payloads.chara).toEqual({ name: 'X', description: '舊' });
  });

  it('兩份 payload 都要合併（chara／ccv3 各自處理）', () => {
    const card: Card = {
      primary: 'ccv3',
      payloads: {
        ccv3: { data: { character_book: book } },
        chara: { character_book: book },
      },
    };
    const out = mergeWorldToggles(card, [{ uid: '0', enabled: false }]) as {
      payloads: { ccv3: { data: { character_book: { entries: Record<string, unknown>[] } } }; chara: { character_book: { entries: Record<string, unknown>[] } } };
    };
    expect(out.payloads.ccv3.data.character_book.entries[0]?.['enabled']).toBe(false);
    expect(out.payloads.chara.character_book.entries[0]?.['enabled']).toBe(false);
  });

  it('不是物件的 payload 原樣退回', () => {
    const card: Card = { primary: 'chara', payloads: { chara: '這不是物件' } };
    expect(mergeWorldToggles(card, [{ uid: '0', enabled: false }]).payloads.chara).toBe('這不是物件');
  });
});
