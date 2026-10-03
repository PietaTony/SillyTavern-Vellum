import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/lib/http';
import { downloadBackupExport } from '../api';

/**
 * `downloadBackupExport`——同 `features/characters/__tests__/exportCard.test.ts` 的理由：
 * 守的是「不是 `window.open`／`<a target="_blank">`那條路」（桌面版動態 port 的坑）。
 */
describe('downloadBackupExport', () => {
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

  it('成功：抓 zip bytes、建 blob 網址、點一個同視窗的 <a download>，用完就收乾淨', async () => {
    const blob = new Blob(['fake-zip-bytes'], { type: 'application/zip' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(blob),
    }) as unknown as typeof fetch;

    await downloadBackupExport();

    expect(global.fetch).toHaveBeenCalledWith('/api/backup/export');
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const clickedAnchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(clickedAnchor.href).toBe('blob:mock-url');
    expect(clickedAnchor.download).toMatch(/^vellum-backup-.*\.zip$/);
    expect(document.body.contains(clickedAnchor)).toBe(false);
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('🔴 失敗：丟出看得懂的錯誤，不點任何 <a>——不是靜默失敗', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: '伺服器內部錯誤' }),
    }) as unknown as typeof fetch;

    await expect(downloadBackupExport()).rejects.toMatchObject({
      message: '伺服器內部錯誤',
    } satisfies Partial<ApiError>);
    expect(clickSpy).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
