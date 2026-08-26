/**
 * 讀取本機圖片並縮到上限尺寸，回傳 data URL。
 *
 * 🔴 為什麼要縮：實測 ST 的預設角色圖 552 KB，base64 之後 payload 736 KB。
 * 不縮的話每張角色卡都帶著一份幾百 KB 的 base64 進 JSON，
 * 而且每次「從圖片生成」都要上傳那麼多 —— 又慢又貴。
 */
const MAX = 256;

export function readImageScaled(file: File, max = MAX): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('這個瀏覽器畫不出 canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('讀不到這張圖'));
    };
    img.src = url;
  });
}

/**
 * 把**任何**頭像來源變成可以送給模型的 data URL。
 *
 * 🔴 **匯入的角色，頭像不是 data URL 是一個路徑**
 * （`server/lib/importCard.ts:87` 存的是 `/api/characters/<id>/avatar.png`，
 * 理由是不要讓每段對話都多帶一份 base64）。
 * 而 `POST /api/characters/from-image` 的 zod 要求 `data:image/` 開頭
 * ⇒ **匯入的卡按「透過圖片自動生成內容」必然回 400「需要一張圖片」**。
 * 不是偶發、不是金鑰問題：自己建立的角色 avatar 是 data URL 所以會過，
 * 匯入的一定不會過（Peter 2026-08-26 回報）。
 *
 * ⚠️ 這種 bug 在**只用自己建的角色測**的時候完全看不到。
 */
export async function toDataUrl(src: string, max = MAX): Promise<string> {
  // 已經是 data URL ＝ 上傳時就縮過了，不必再走一次 canvas。
  if (src.startsWith('data:image/')) return src;
  if (src === '') throw new Error('需要一張圖片');
  const res = await fetch(src);
  if (!res.ok) throw new Error(`讀不到這張頭像（HTTP ${res.status}）`);
  const blob = await res.blob();
  return readImageScaled(new File([blob], 'avatar.png', { type: blob.type || 'image/png' }), max);
}
