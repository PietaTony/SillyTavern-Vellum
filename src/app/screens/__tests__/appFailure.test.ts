import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/lib/http';
import { describeFailure } from '../appFailure';

/**
 * 「整頁打不開」時畫面上該說什麼。
 *
 * 🔴 這支守的重點是 **502 與 500 不可以講成同一件事**：
 * 500 ＝ 後端有在跑、它自己出錯（下一步是看 log）；
 * 502 ＝ 根本沒接到人（下一步是把後端開起來）。混在一起講，使用者會往錯的方向找。
 *
 * 🔴 以及**原文永遠要留** —— 這是全站既有的規則（`failureOf`、`CopyButton` 同一條）：
 * 猜錯病因而把上游訊息丟掉，比多幾個括號糟得多。
 */
describe('describeFailure', () => {
  it('🔴 502／503／504 要說「後端沒在跑」，而且給得出再試一次', () => {
    for (const s of [502, 503, 504]) {
      const f = describeFailure(new ApiError(`HTTP ${s}`, s));
      expect(f.title).toContain('後端沒有回應');
      expect(f.what).toContain('後端沒在跑');
      expect(f.retryable).toBe(true);
    }
  });

  it('🔴 500 要跟 502 講不一樣的下一步 —— 它有在跑，是它自己出錯', () => {
    const f = describeFailure(new ApiError('boom', 500));
    expect(f.title).toContain('出錯');
    expect(f.what).not.toContain('沒在跑');
  });

  it('連不上（fetch 丟 TypeError）要講裝置與網路，不是講後端', () => {
    const f = describeFailure(new TypeError('Failed to fetch'));
    expect(f.title).toBe('連不上 Vellum');
    expect(f.what).toContain('Tailscale');
    expect(f.retryable).toBe(true);
  });

  it('🔴 每一種都要把原文留下來 —— 複製鈕靠它，猜錯病因也還有救', () => {
    const cases: unknown[] = [
      new ApiError('HTTP 502：Bad Gateway', 502),
      new ApiError('寫不進去', 500),
      new ApiError('沒有這個', 404),
      new TypeError('Load failed'),
      new Error('別的東西壞了'),
      '一個裸字串',
    ];
    for (const e of cases) expect(describeFailure(e).detail.trim()).not.toBe('');
  });

  it('4xx 不給「再試一次」—— 同樣的要求再送一百次也是同一個答案', () => {
    expect(describeFailure(new ApiError('沒有這個', 404)).retryable).toBe(false);
    expect(describeFailure(new ApiError('不准', 403)).retryable).toBe(false);
  });
});
