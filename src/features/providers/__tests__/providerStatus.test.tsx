import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { isReady, PROVIDERS } from '../model';
import { ProviderCard } from '../ui/ProviderCard';

/**
 * 守的是 2026-08-25 抓到的那條死路：
 * Anthropic 在清單上完全可選 → 貼金鑰 → 測試連線 → 後端回 400 →
 * `keyGate.machine` 停在 `failed` → **「下一步」永遠解不開**。
 *
 * 🔴 使用者不是「看到沒有這個選項」，是**選了、照做了、然後出不去**，
 * 而 first-run 正是他第一次用這個產品的路徑。
 */
describe('供應商能力宣告', () => {
  it('每一家都要表態 —— 沒有 status 就不知道送不送得出去', () => {
    expect(PROVIDERS.length).toBeGreaterThan(0); // 涵蓋率：0 筆必然 PASS，先擋掉
    for (const p of PROVIDERS) expect(['ready', 'planned']).toContain(p.status);
  });

  /**
   * 🔴 **這條測試紅掉是提醒，不是壞掉。**
   * 接上新的一家時，要同時改三個地方，這條會逼你想起後兩個：
   *   ① `PROVIDERS[].status` 改成 `ready`
   *   ② `server/routes/secrets.ts` 的 `/test` 白名單
   *   ③ 這條測試的預期值
   */
  it('前端說 ready 的，後端必須真的送得出去（目前只有 google）', () => {
    expect(PROVIDERS.filter(isReady).map((p) => p.id)).toEqual(['google']);
  });

  it('還沒接上的那家在清單上，但點不下去', () => {
    const planned = PROVIDERS.find((p) => !isReady(p));
    expect(planned).toBeDefined();
    if (!planned) return;
    const onToggle = vi.fn();
    render(<ProviderCard info={planned} selected={false} onToggle={onToggle} />);
    // 🔴 名字仍然看得到 —— 不藏起來，藏起來會讓人以為產品沒這個功能
    expect(screen.getByText(planned.name)).toBeTruthy();
    expect(screen.getByRole('button')).toHaveProperty('disabled', true);
  });

  it('接上的那家點得下去', () => {
    const ready = PROVIDERS.find(isReady);
    expect(ready).toBeDefined();
    if (!ready) return;
    render(<ProviderCard info={ready} selected={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveProperty('disabled', false);
  });
});
