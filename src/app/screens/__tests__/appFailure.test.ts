import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/lib/http';
import { describeFailure } from '../appFailure';

/**
 * 「整頁打不開」時畫面上該說什麼。
 *
 * 🔴 **文案裡不可以出現「後端」**（Peter 2026-08-27：「user 的角度並沒有後端的概念，
 * 他們在執行面上是 exe 掛掉了才對」）。打包版裡前端與 API 是同一支程式 ——
 * 前端／後端是我們的分工，不是他的世界。這條用測試釘住，因為它是**很容易改回去**的那種：
 * 下一個人在講 502 的時候，最自然的講法就是「後端」。
 *
 * 🔴 以及 **502 與 500 不可以講成同一件事**：
 * 500 ＝ 程式還活著、這件事做壞了（下一步是把原文給我們）；
 * 502／連不上 ＝ 根本沒接到人（下一步是回去看那台電腦）。混在一起講會讓人往錯的方向找。
 *
 * 🔴 以及**原文永遠要留** —— 這是全站既有的規則（`failureOf`、`CopyButton` 同一條）：
 * 猜錯病因而把上游訊息丟掉，比多幾個括號糟得多。
 */
describe('describeFailure', () => {
  it('🔴 任何一種都不可以對使用者講「後端」', () => {
    const cases: unknown[] = [
      new ApiError('HTTP 502', 502),
      new ApiError('HTTP 503', 503),
      new ApiError('HTTP 504', 504),
      new ApiError('boom', 500),
      new ApiError('沒有這個', 404),
      new ApiError('不准', 403),
      new TypeError('Failed to fetch'),
      new Error('別的東西壞了'),
      '一個裸字串',
    ];
    for (const e of cases) {
      const f = describeFailure(e);
      expect(`${f.title}｜${f.what}`).not.toContain('後端');
      expect(`${f.title}｜${f.what}`).not.toContain('前端');
    }
  });

  it('🔴 502／503／504 要說「Vellum 沒有回應」，並指回那台電腦', () => {
    for (const s of [502, 503, 504]) {
      const f = describeFailure(new ApiError(`HTTP ${s}`, s));
      expect(f.title).toBe('Vellum 沒有回應');
      expect(f.what).toContain('那台電腦');
      expect(f.retryable).toBe(true);
    }
  });

  it('🔴 連不上（fetch 丟 TypeError）跟 502 是同一件事 —— 對使用者都是「程式不在了」', () => {
    const a = describeFailure(new TypeError('Failed to fetch'));
    const b = describeFailure(new ApiError('HTTP 502', 502));
    expect(a.title).toBe(b.title);
    expect(a.what).toBe(b.what);
    expect(a.detail).toBe('Failed to fetch');
  });

  it('🔴 500 的下一步不一樣 —— 程式還活著，叫他去重開等於把他支開', () => {
    const f = describeFailure(new ApiError('boom', 500));
    expect(f.title).toBe('Vellum 出錯了');
    expect(f.what).toContain('還在跑');
    expect(f.what).not.toContain('那台電腦');
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
