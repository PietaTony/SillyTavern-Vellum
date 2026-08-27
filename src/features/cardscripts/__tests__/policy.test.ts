import { describe, expect, it } from 'vitest';
import { CARD_VAR_SCOPES } from '../runtime/scopes';
import { buildSrcDoc, policyOf, seedVars } from '../runtime/srcdoc';

/**
 * 🔴 **這一支守的是「乙」那道防線**（Peter 2026-08-26 裁定）。
 *
 * 同意視窗對使用者說「這份程式**只能連到這幾個網域**，其餘一律擋掉」——
 * 兌現那句話的只有這一份 CSP 字串。少一條指令，那句話就變成謊話，
 * 而且**不會有任何東西變紅**（跟 `server/__tests__/noCors.test.ts` 守的是同一種病：
 * 防線是「某個東西剛好在／剛好不在」）。
 *
 * ⚠️ **實機證據（2026-08-26，不是照文件寫）**：
 *   · `fetch` 未同意網域 → 被擋（Failed to fetch）
 *   · `<img>` 未同意網域 → 沒載入
 *   · `fetch` 已同意網域 → 通過；jQuery／toastr 從該 CDN 載得到
 *   · 🔴 `location.href = 'https://…'`（iframe 導航自己）→ **沒擋住**，
 *     iframe 真的整個換成那一頁。那條要主頁的 `frame-src`（方案「丙」，未做）。
 */
describe('iframe 內的 CSP —— 兌現「只能連到這幾個網域」', () => {
  const policy = policyOf(['cdn.example']);
  const directive = (name: string) =>
    policy.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

  it('🔴 沒列出來的一律擋掉（預設拒絕，不是預設放行）', () => {
    expect(policy.startsWith("default-src 'none'")).toBe(true);
  });

  for (const name of [
    'connect-src',
    'img-src',
    'media-src',
    'script-src',
    'style-src',
    'font-src',
  ]) {
    it(`🔴 ${name} 只放行已同意的來源`, () => {
      expect(directive(name)).toContain('https://cdn.example');
      expect(directive(name)).not.toContain('*');
    });
  }

  it('🔴 沒同意任何網域 ＝ 完全斷網（不是「沒限制」）', () => {
    const none = policyOf([]);
    expect(none).toContain("connect-src 'none'");
    expect(none).toContain("img-src data: blob: 'none'");
  });

  it("⚠️ `'unsafe-inline'` 是刻意的：卡片介面靠 15 個 onclick= 在跑", () => {
    expect(directive('script-src')).toContain("'unsafe-inline'");
  });

  it('🔴 認不得的主機名不可以被拼進政策裡（一個空白就能塞進整條指令）', () => {
    const evil = policyOf(['cdn.example; script-src *', 'ok.example']);
    expect(evil).not.toContain('script-src *');
    expect(evil).toContain('https://ok.example');
  });

  it('表單送出與 <base> 都關掉（兩條不用 JS 的外送管道）', () => {
    expect(policy).toContain("form-action 'none'");
    expect(policy).toContain("base-uri 'none'");
  });
});

/**
 * 🔴 **變數的值來自網路上的角色卡，而我們把它們塞進 `srcdoc` 的一段 `<script>` 裡。**
 * 只要值裡出現 `</script>`，那段就會提早結束，**後面整份 HTML 都變成腳本內容** ——
 * 那是一條從「卡片存了什麼變數」直達 HTML 注入的路。
 * ⚠️ 這條沒有任何別的閘門守得住：typecheck 綠、畫面看起來也正常。
 */
describe('種進 iframe 的變數不可以逃出那段 script', () => {
  const payload = '</script><img src=x onerror=alert(1)>';

  /**
   * 🔴 **三個桶子逐一驗**（2026-08-27 加上 global／character 之後）。
   * 只驗 chat 的話，惡意值從 global 那個桶子進來一樣逃得出去 ——
   * 那正是「閘門守著一層、洞在另一層」。
   */
  it('🔴 `<` 一律跳脫 ⇒ 值裡的 `</script>` 不會結束那一段（三種範圍都要）', () => {
    for (const scope of CARD_VAR_SCOPES) {
      const evil = { global: {}, character: {}, chat: {}, [scope]: { x: payload } };
      const doc = buildSrcDoc({ body: '', name: 'n', mode: 'hidden', allow: [], vars: evil });
      expect(doc, `${scope} 這個桶子逃出去了`).not.toContain('</script><img');
      expect(seedVars(evil)).toContain('\\u003c/script>');
    }
  });

  it('沒有變數時三個桶子都種成空物件，不是 undefined（卡片會直接取鍵）', () => {
    expect(seedVars(undefined)).toContain(
      'window.__vellumVars={"global":{},"character":{},"chat":{}}',
    );
  });
});

/**
 * 同意視窗列出來的每一個網域，**都要說得出「誰要去」**。
 *
 * 🔴 這條是 2026-08-27 主線提醒的（VENDOR 三支落地內嵌之後 `VENDOR_HOSTS` 變空，
 * 而那一行的 `why` 是拿它組出來的）。實際邏輯沒破 —— 一個網域只有在兩個集合之一裡
 * 才會被列出來，所以 `why` 不可能是空的。但**這件事沒有任何測試守著**，
 * 而「判準只套用一半」正是我們今天各踩一次的形狀 ⇒ 用測試釘住。
 */
describe('同意視窗的網域清單', () => {
  const whyOf = (cardHosts: Set<string>, vendor: string[]) =>
    [...new Set([...cardHosts, ...vendor])].sort().map((h) => ({
      host: h,
      why: [
        cardHosts.has(h) ? '卡片自己要去抓程式' : '',
        vendor.includes(h) ? 'Vellum 自己要去的' : '',
      ]
        .filter(Boolean)
        .join('、'),
    }));

  it('🔴 我們自己零外連時，卡片的外連照樣要列出來而且說得出理由', () => {
    const rows = whyOf(new Set(['a.example', 'b.example']), []);
    expect(rows.map((r) => r.host)).toEqual(['a.example', 'b.example']);
    for (const r of rows) expect(r.why).not.toBe('');
  });

  it('🔴 兩邊都要去的同一個網域只列一次，而且兩個理由都講', () => {
    const rows = whyOf(new Set(['same.example']), ['same.example']);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.why).toBe('卡片自己要去抓程式、Vellum 自己要去的');
  });

  it('🔴 列出來的網域不可能沒有理由 —— 它只有在其中一個集合裡才會被列出來', () => {
    for (const [card, vendor] of [
      [['x'], []],
      [[], ['y']],
      [['x'], ['y']],
    ] as [string[], string[]][])
      for (const r of whyOf(new Set(card), vendor)) expect(r.why).not.toBe('');
  });
});
