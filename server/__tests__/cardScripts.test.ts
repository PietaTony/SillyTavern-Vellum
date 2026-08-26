import { describe, expect, it } from 'vitest';
import { isFrontend } from '../../src/features/chat/render/frontend.ts';
import { externalsOf } from '../lib/cardExternals.ts';
import {
  allExternals,
  interfacesOf,
  inventoryOf,
  isCardInterface,
  scriptsOf,
} from '../lib/cardScripts.ts';

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
      kind: 'script',
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


/**
 * 🔴 **2026-08-26 補的一整塊：卡片的程式帶在兩個地方，在此之前只盤了一個。**
 * 實測「何思年」那張卡使用者真正會點的「CHOOSE YOUR TIMELINE」介面來自
 * `regex_scripts[1].replaceString`（17,862 字元），**不是** `tavern_helper`。
 * 少盤它 ⇒ 同意視窗少報了真正會執行的那一份。
 */
describe('interfacesOf —— 顯示用 regex 換出來的那份 HTML', () => {
  const face = { scriptName: '開場頁', replaceString: '<head><style>x</style></head><body>y</body>' };

  it('🔴 抓得到會變成畫面的 HTML', () => {
    expect(interfacesOf([face])).toEqual([
      { name: '開場頁', enabled: true, bytes: 43, externals: [], kind: 'interface' },
    ]);
  });

  it('🔴 `promptOnly` 的規則永遠不會變成畫面 —— 列進來只會多嚇人一次', () => {
    expect(interfacesOf([{ ...face, promptOnly: true }])).toEqual([]);
  });

  it('不是完整網頁的替換字串不算介面（單純換字的規則有一大堆）', () => {
    expect(interfacesOf([{ scriptName: '取代髒話', replaceString: '嗶' }])).toEqual([]);
  });

  it('卡片作者關掉的要照實回報，不是濾掉 —— 那是他的標記，不是我們的同意', () => {
    expect(interfacesOf([{ ...face, disabled: true }])[0]?.enabled).toBe(false);
  });

  it('認不得的形狀一律空陣列', () => {
    expect(interfacesOf(undefined)).toEqual([]);
    expect(interfacesOf('nope')).toEqual([]);
  });
});

/**
 * 🔴 **判準的雙胞胎**：後端用 `isCardInterface` 決定「要不要問」，
 * 前端用 `isFrontend` 決定「要不要跑」。兩邊一旦分岔就會出現
 * **「盤點說沒有、畫面卻把它跑起來」** 的破口。
 * ⚠️ 這裡比的是**行為**不是字串 —— 比字串的話任一邊搬檔或改寫法就靜靜失效。
 */
describe('後端的「是不是介面」與前端的「是不是前端區塊」必須同一個答案', () => {
  const cases = [
    '<head><style>a</style></head>',
    '<body>hi</body>',
    '<html><body>hi</body></html>',
    '</html>',
    'const x = 1',
    '',
    '<div>只有 div 不算</div>',
    '沒有任何標籤',
  ];
  for (const c of cases) {
    it(`同一個答案：${JSON.stringify(c.slice(0, 24))}`, () => {
      expect(isCardInterface(c)).toBe(isFrontend(c));
    });
  }
});

describe('inventoryOf —— 這張卡總共會執行哪些東西', () => {
  const extensions = {
    tavern_helper: { scripts: [{ name: '背景', enabled: true, content: 'const a = 1' }] },
    regex_scripts: [{ scriptName: '開場頁', replaceString: '<body>ui</body>' }],
  };

  it('🔴 背景腳本與顯示介面要一起盤 —— 只盤一半，同意視窗就少報一半', () => {
    expect(inventoryOf(extensions)?.scripts.map((s) => [s.name, s.kind])).toEqual([
      ['背景', 'script'],
      ['開場頁', 'interface'],
    ]);
  });

  it('🔴 只有介面、沒有背景腳本的卡也要盤得出來（不然它永遠等不到同意視窗）', () => {
    expect(inventoryOf({ regex_scripts: extensions.regex_scripts })?.scripts).toHaveLength(1);
  });

  it('🔴 介面的內容變了，指紋要跟著變 —— 不然換掉 UI 不會重新詢問', () => {
    const a = inventoryOf(extensions)?.hash;
    const b = inventoryOf({
      ...extensions,
      regex_scripts: [{ scriptName: '開場頁', replaceString: '<body>壞人的 ui</body>' }],
    })?.hash;
    expect(a).not.toBe(b);
  });

  it('🔴 長度一樣但內容不同也要換指紋（用 bytes 當指紋會漏掉這種）', () => {
    const a = inventoryOf({ regex_scripts: [{ scriptName: 'x', replaceString: '<body>aaa</body>' }] })?.hash;
    const b = inventoryOf({ regex_scripts: [{ scriptName: 'x', replaceString: '<body>bbb</body>' }] })?.hash;
    expect(a).not.toBe(b);
  });

  it('同樣的輸入要得到同樣的指紋（不然每次開啟都會重問）', () => {
    expect(inventoryOf(extensions)?.hash).toBe(inventoryOf(extensions)?.hash);
  });

  it('兩邊都沒有就回 null', () => {
    expect(inventoryOf({})).toBeNull();
    expect(inventoryOf(null)).toBeNull();
  });
});
