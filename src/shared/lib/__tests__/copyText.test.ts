import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from '../copyText';

/**
 * 🔴 這支測的是**那個會害人的分支**，而它在此之前沒有任何測試守著：
 * 從 Tailscale 位址（實測 `http://100.89.95.93:8520` ⇒ `isSecureContext === false`）開時
 * `navigator.clipboard` 是 **`undefined`**，不是「呼叫失敗」而是「不存在」。
 * 那是 Peter 平常的開法 —— 只寫 `navigator.clipboard.writeText()` 的版本在他手機上
 * **按了什麼都不會發生，也不會報錯**。
 *
 * ⚠️ `copyText` 檔頭早就寫明這件事，但**寫明 ≠ 有人守著**：
 * 下一次有人「順手清理 deprecated API」把 `execCommand` 拿掉時，
 * 沒有這支測試就沒有東西會紅。
 */
describe('copyText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('有 clipboard API 就走它', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyText('abc')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('abc');
  });

  it('🔴 沒有 clipboard API（非安全來源）要退到 execCommand，不可以靜默失敗', async () => {
    vi.stubGlobal('navigator', {});
    const exec = vi.fn().mockReturnValue(true);
    document.execCommand = exec;
    expect(await copyText('abc')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('clipboard API 丟例外時不可以放棄，要往下走 execCommand', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) },
    });
    const exec = vi.fn().mockReturnValue(true);
    document.execCommand = exec;
    expect(await copyText('abc')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('兩條路都不通要回 false —— 呼叫端才說得出「請長按選取」', async () => {
    vi.stubGlobal('navigator', {});
    document.execCommand = vi.fn().mockReturnValue(false);
    expect(await copyText('abc')).toBe(false);
  });

  it('複製完要把暫存的 textarea 移除，不可以留在 DOM 裡', async () => {
    vi.stubGlobal('navigator', {});
    document.execCommand = vi.fn().mockReturnValue(true);
    await copyText('abc');
    expect(document.querySelectorAll('textarea').length).toBe(0);
  });
});
