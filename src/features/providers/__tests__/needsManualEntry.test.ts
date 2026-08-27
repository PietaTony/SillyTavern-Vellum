import { describe, expect, it } from 'vitest';
import { needsManualEntry } from '../modelOptions';

/**
 * 🔴 **Peter 2026-08-27 實機踩到**：「第一次填寫 api key 以後，下方的 dropdown
 * 會錯誤變成 input box。」
 *
 * `/api/secrets/models/:provider` 的失敗有兩種，意思完全相反 ——
 * 後端**特地加了 `manual` 旗標**來分辨，而前端原本寫的是 `!q.data.ok`，
 * 把兩種混成一種。這幾條就是守那個分辨。
 */
describe('needsManualEntry', () => {
  it('🔴 「還沒設定金鑰」不是手動輸入 —— 補了金鑰就有清單了', () => {
    // `exactOptionalPropertyTypes` ⇒ 「沒有這個欄位」要真的不寫，不是寫 undefined
    expect(needsManualEntry({ ok: false })).toBe(false);
  });

  it('🔴 「這一家沒有提供模型清單」才是手動輸入', () => {
    expect(needsManualEntry({ ok: false, manual: true })).toBe(true);
  });

  it('拿得到清單當然不用手動', () => {
    expect(needsManualEntry({ ok: true })).toBe(false);
  });

  it('還沒回來（undefined）不要先跳成手動 —— 那會閃一下輸入框', () => {
    expect(needsManualEntry(undefined)).toBe(false);
  });

  it('🔴 `manual` 只認 true，不認任何 truthy 值', () => {
    // 後端要是哪天回了 `manual: 'yes'`，那是形狀變了，該紅而不是矇混過去
    expect(needsManualEntry({ ok: false, manual: 1 as unknown as boolean })).toBe(false);
  });
});
