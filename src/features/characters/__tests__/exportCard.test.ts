import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/lib/http';
import { downloadCharacterCard } from '../lib/exportCard';

/**
 * `downloadCharacterCard`（B1）：真正觸發下載的那一步。
 *
 * 🔴 **不能用 `<a target="_blank">`／`window.open`**（見 `lib/exportCard.ts` 檔頭）——
 * 桌面版 `electron/main.cjs` 的 `setWindowOpenHandler` 會把任何「開新視窗」的請求
 * 轉去系統瀏覽器打 `127.0.0.1:<動態 port>`，那個 port 只有這次啟動的桌面版知道。
 * 這裡守的就是「不是那條路」：`window.open` 全程沒被呼叫過。
 */
describe('downloadCharacterCard', () => {
  const originalFetch = global.fetch;
  const originalOpen = window.open;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let windowOpenSpy: ReturnType<typeof vi.fn<typeof window.open>>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock-url');
    revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    // 🔴 真的觸發 navigation 的話 jsdom 會印一堆「Not implemented」噪音，
    // 而且我們要驗的是「有沒有點下去」而不是瀏覽器真的存了檔——那件事
    // 交給 Content-Disposition: attachment（伺服器端已測）＋ Electron 的預設下載行為。
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    windowOpenSpy = vi.fn();
    window.open = windowOpenSpy;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.open = originalOpen;
    clickSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('成功：抓 bytes、建 blob 網址、點一個同視窗的 <a download>，用完就收乾淨', async () => {
    const blob = new Blob(['fake-png-bytes'], { type: 'image/png' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(blob),
    }) as unknown as typeof fetch;

    await downloadCharacterCard('char-1');

    expect(global.fetch).toHaveBeenCalledWith('/api/characters/char-1/card.png');
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    // 點下去的那個 <a> 帶對的 href／download，而且從頭到尾沒開過新視窗。
    const clickedAnchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(clickedAnchor.href).toBe('blob:mock-url');
    expect(clickedAnchor.download).toBe('char-1.png');
    expect(document.body.contains(clickedAnchor)).toBe(false); // click 完就 remove() 了
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('🔴 失敗（例如自建角色打到 404）：丟出看得懂的錯誤，不點任何 <a>——不是靜默失敗', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: '這個角色不是匯入的卡片' }),
    }) as unknown as typeof fetch;

    await expect(downloadCharacterCard('self-made')).rejects.toMatchObject({
      message: '這個角色不是匯入的卡片',
    } satisfies Partial<ApiError>);
    expect(clickSpy).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
