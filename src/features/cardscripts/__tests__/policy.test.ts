import { describe, expect, it } from 'vitest';
import { policyOf } from '../ui/ScriptFrame';

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
