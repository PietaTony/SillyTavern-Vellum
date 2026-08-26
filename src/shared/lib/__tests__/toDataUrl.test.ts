import { afterEach, describe, expect, it, vi } from 'vitest';
import { toDataUrl } from '../image';

/**
 * 🔴 **這支守的是一個「只在匯入的角色上發生」的 bug**（Peter 2026-08-26 回報）。
 *
 * 匯入的角色頭像存的是**路徑**（`/api/characters/<id>/avatar.png`，
 * `server/lib/importCard.ts:87` —— 為了不讓每段對話都多帶一份 base64），
 * 而 `POST /api/characters/from-image` 的 zod 要求 `data:image/` 開頭
 * ⇒ 匯入的卡按「透過圖片自動生成內容」**必然** 400「需要一張圖片」。
 *
 * ⚠️ **用自己建立的角色測永遠看不到**：那條路徑的 avatar 本來就是 data URL。
 * 這正是「假綠燈：測試過只代表你的資料沒走那條路徑」的形狀。
 */
afterEach(() => vi.unstubAllGlobals());

describe('toDataUrl', () => {
  it('已經是 data URL 就原樣回傳（不必再走一次 canvas）', async () => {
    const src = 'data:image/png;base64,iVBORw0KGgo=';
    // 沒有 stub fetch —— 真的去打網路的話這條會炸，正好證明它沒有繞路。
    expect(await toDataUrl(src)).toBe(src);
  });

  it('🔴 是路徑就要去抓（匯入的角色走的正是這條）', async () => {
    const seen: string[] = [];
    vi.stubGlobal('fetch', (u: string) => {
      seen.push(u);
      return Promise.resolve(new Response(new Blob([new Uint8Array([1, 2, 3])])));
    });
    /*
     * ⚠️ **不可以 `await` 它。** jsdom 不會真的載入圖片 ⇒ `readImageScaled` 裡的
     * `img.onload`／`onerror` 都不觸發，那個 Promise 永遠 pending，測試會 timeout。
     * 我們要驗的是**「有沒有去抓」**，縮圖那一步不是這條的守備範圍。
     */
    void toDataUrl('/api/characters/abc/avatar.png').catch(() => undefined);
    await vi.waitFor(() => expect(seen).toEqual(['/api/characters/abc/avatar.png']));
  });

  it('抓不到要說得出是哪一步壞的，不可以靜靜回空字串', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('', { status: 404 })));
    await expect(toDataUrl('/api/characters/nope/avatar.png')).rejects.toThrow('HTTP 404');
  });

  it('空字串 ＝ 根本沒有頭像', async () => {
    await expect(toDataUrl('')).rejects.toThrow('需要一張圖片');
  });
});
