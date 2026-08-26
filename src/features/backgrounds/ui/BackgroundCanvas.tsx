import Box from '@mui/material/Box';
import { backgroundUrl, type Fitting, fittingStyle } from '../model';

/**
 * 墊在最底下的那張圖。**照抄 ST 的 `#bg1`**（`public/css/backgrounds.css:2-10`）：
 * `position: fixed`、鋪滿視窗、`z-index: -1`，不參與捲動。
 *
 * 🔴 **`aria-hidden`**：它沒有任何資訊，讓螢幕閱讀器唸出「圖片」只是噪音。
 * 🔴 **檔名直接進 `url("...")`** 是安全的 —— `safeBackgroundName` 已經擋掉
 * `"`、`\`、控制字元與路徑分隔，而且 `backgroundUrl` 另外做了 `encodeURIComponent`。
 * ⚠️ 那兩層是這一行的前提，動其中任何一層之前先回來看這裡。
 */
export function BackgroundCanvas({
  name,
  fitting,
}: {
  name?: string | undefined;
  fitting: Fitting;
}) {
  if (!name) return null;
  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        backgroundImage: `url("${backgroundUrl(name)}")`,
        ...fittingStyle(fitting),
      }}
    />
  );
}
