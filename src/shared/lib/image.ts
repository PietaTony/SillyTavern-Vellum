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
