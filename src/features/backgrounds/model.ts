/**
 * 背景的純資料層（A4：不碰 DOM／api／store）。
 *
 * 🔴 **五個縮放模式照抄 ST**（`public/css/backgrounds.css:2-38`），連 `classic` 也照留。
 * `classic` 與 `cover` **不是重複選項**：
 *   `classic` → `background-size: cover`，位置沿用預設 `0% 0%` ⇒ **貼齊左上**
 *   `cover`   → 一樣 `cover`，但 `background-position: center` ⇒ **置中**
 * 直式人像圖上差別很明顯（左上會切掉臉）。
 */
export const FITTINGS = ['classic', 'cover', 'contain', 'stretch', 'center'] as const;
export type Fitting = (typeof FITTINGS)[number];

export const FITTING_LABEL: Record<Fitting, string> = {
  classic: '經典',
  cover: '填滿',
  contain: '完整顯示',
  stretch: '拉伸',
  center: '原尺寸置中',
};

/** 縮圖與大圖共用同一組規則 —— 縮圖若用不同的裁切方式，選出來的結果就會與預期不符。 */
export function fittingStyle(f: Fitting): {
  backgroundSize: string;
  backgroundPosition: string;
  backgroundRepeat: string;
} {
  const base = { backgroundRepeat: 'no-repeat' };
  if (f === 'contain') return { ...base, backgroundSize: 'contain', backgroundPosition: 'center' };
  if (f === 'stretch')
    return { ...base, backgroundSize: '100% 100%', backgroundPosition: 'center' };
  if (f === 'center') return { ...base, backgroundSize: 'auto', backgroundPosition: 'center' };
  if (f === 'cover') return { ...base, backgroundSize: 'cover', backgroundPosition: 'center' };
  return { ...base, backgroundSize: 'cover', backgroundPosition: '0% 0%' };
}

/**
 * 圖片網址。🔴 **一定要 `encodeURIComponent`** —— ST 內建 23 張裡有 20 張檔名帶空格，
 * 還有一張帶括號（`forest treehouse fireworks air baloons (by kallmeflocc).jpg`）。
 */
export const backgroundUrl = (name: string): string =>
  `/api/backgrounds/file/${encodeURIComponent(name)}`;
