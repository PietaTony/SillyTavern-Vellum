import { describe, expect, it } from 'vitest';
import { applyEntryEdit } from '../lib/wiEdit.ts';
import type { WbEntry } from '../lib/worldbook.ts';

const entry = (over: Partial<WbEntry> = {}): WbEntry => ({
  uid: '3',
  keys: ['a'],
  secondaryKeys: [],
  content: '原本的內容',
  comment: '成年_接近',
  constant: true,
  enabled: false,
  selective: false,
  selectiveLogic: 0,
  order: 80,
  position: 1,
  depth: 4,
  role: null,
  caseSensitive: false,
  matchWholeWords: false,
  probability: 100,
  useProbability: false,
  group: '',
  ignoreBudget: false,
  raw: {
    id: 3,
    keys: ['a'],
    content: '原本的內容',
    comment: '成年_接近',
    enabled: false,
    insertion_order: 80,
    extensions: { depth: 4, position: 1, 我們不認得的: { 巢狀: 1 } },
  },
  ...over,
});

describe('條目編輯（C3）', () => {
  it('上層欄位有改到', () => {
    const e = applyEntryEdit(entry(), { content: '改過的內容', order: 50 });
    expect(e.content).toBe('改過的內容');
    expect(e.order).toBe(50);
  });

  /**
   * 🔴 **這一條是本檔存在的理由。** `raw` 是「無資訊遺失」那條契約跟著匯出走的那一份。
   * 只改上層的話，哪天接上世界書匯出，**使用者的編輯會被 raw 裡的舊值靜默蓋掉**。
   */
  it('🔴 raw 也要同步 —— 不然匯出時會寫回舊值', () => {
    const e = applyEntryEdit(entry(), { content: '改過的內容', order: 50 });
    expect(e.raw['content']).toBe('改過的內容');
    expect(e.raw['insertion_order']).toBe(50); // 🔴 卡內叫 insertion_order 不是 order
  });

  it('🔴 住在 extensions 底下的欄位要寫進 extensions', () => {
    const e = applyEntryEdit(entry(), { depth: 9, probability: 30 });
    const ext = e.raw['extensions'] as Record<string, unknown>;
    expect(ext['depth']).toBe(9);
    expect(ext['probability']).toBe(30);
  });

  it('🔴 認不得的鍵原樣保留 —— 正規化寫回＝資料損毀', () => {
    const e = applyEntryEdit(entry(), { content: 'x' });
    const ext = e.raw['extensions'] as Record<string, unknown>;
    expect(ext['我們不認得的']).toEqual({ 巢狀: 1 });
    expect(e.raw['id']).toBe(3);
  });

  it('🔴 沒送的欄位不可以被清成 undefined', () => {
    const e = applyEntryEdit(entry(), { content: 'x', keys: undefined });
    expect(e.keys).toEqual(['a']);
    expect(e.comment).toBe('成年_接近');
  });

  it('原本的 entry 不被就地改掉（純函式）', () => {
    const before = entry();
    applyEntryEdit(before, { content: '改過的' });
    expect(before.content).toBe('原本的內容');
    expect(before.raw['content']).toBe('原本的內容');
  });

  it('沒有 extensions 的條目不會被憑空加一個空的', () => {
    const bare = entry({ raw: { id: 3, content: 'x' } });
    const e = applyEntryEdit(bare, { comment: '改名' });
    expect(e.raw['extensions']).toBeUndefined();
  });

  it('陣列欄位（關鍵字）雙邊都改到', () => {
    const e = applyEntryEdit(entry(), { keys: ['b', 'c'], secondaryKeys: ['d'] });
    expect(e.keys).toEqual(['b', 'c']);
    expect(e.raw['keys']).toEqual(['b', 'c']);
    expect(e.raw['secondary_keys']).toEqual(['d']); // 🔴 卡內叫 secondary_keys
  });
});

/**
 * 🔴 **外部世界書檔（匯入）用另一套鍵名，且沒有 `extensions`**（`worldbook.ts` 檔頭）。
 * 選錯對照表會把兩套鍵名混進同一個 `raw`，或漏寫剛剛的編輯 —— 這批測試守 `rawSchema`
 * 真的有被讀到、而不是永遠走卡內那一套。
 */
describe('條目編輯 —— 外部世界書檔那一套（rawSchema: worldFile）', () => {
  const wfEntry = (over: Partial<WbEntry> = {}): WbEntry => ({
    uid: '0',
    keys: ['甲'],
    secondaryKeys: [],
    content: '內容',
    comment: '',
    constant: false,
    enabled: true,
    selective: false,
    selectiveLogic: 0,
    order: 100,
    position: 0,
    depth: 4,
    role: null,
    caseSensitive: false,
    matchWholeWords: false,
    probability: 100,
    useProbability: false,
    group: '',
    ignoreBudget: false,
    rawSchema: 'worldFile',
    raw: { uid: 0, key: ['甲'], content: '內容', disable: false, sticky: 5 },
    ...over,
  });

  it('🔴 頂層鍵名（沒有 extensions）：depth／probability 直接寫在 raw 頂層', () => {
    const e = applyEntryEdit(wfEntry(), { depth: 9, probability: 30 });
    expect(e.raw['depth']).toBe(9);
    expect(e.raw['probability']).toBe(30);
    expect(e.raw['extensions']).toBeUndefined(); // 外部檔本來就不用這個
  });

  it('🔴 `enabled` 要反過來寫成 `disable`', () => {
    const e = applyEntryEdit(wfEntry(), { enabled: false });
    expect(e.raw['disable']).toBe(true);
    const e2 = applyEntryEdit(wfEntry({ enabled: false, raw: { disable: true } }), { enabled: true });
    expect(e2.raw['disable']).toBe(false);
  });

  it('關鍵字寫回 `key`／`keysecondary`，不是卡內的 `keys`／`secondary_keys`', () => {
    const e = applyEntryEdit(wfEntry(), { keys: ['乙'], secondaryKeys: ['丙'] });
    expect(e.raw['key']).toEqual(['乙']);
    expect(e.raw['keysecondary']).toEqual(['丙']);
    expect(e.raw['keys']).toBeUndefined();
  });

  it('🔴 認不得的欄位（sticky）原樣保留 —— 這套 schema 也適用同一條契約', () => {
    const e = applyEntryEdit(wfEntry(), { content: 'x' });
    expect(e.raw['sticky']).toBe(5);
  });

  it('省略 rawSchema 時預設走卡內那一套（既有呼叫端不受影響）', () => {
    const legacy = entry(); // 上面卡內那套的 entry()，沒有 rawSchema
    const e = applyEntryEdit(legacy, { depth: 9 });
    const ext = e.raw['extensions'] as Record<string, unknown>;
    expect(ext['depth']).toBe(9); // 走卡內那套，寫進 extensions
  });
});
