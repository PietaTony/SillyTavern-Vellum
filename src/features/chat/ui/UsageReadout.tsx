import Typography from '@mui/material/Typography';
import type { Usage } from '../model';
import { formatUsage } from '../usageFormat';

/**
 * B4：這一輪用量的讀數。供應商層早就算好了（`server/providers/types.ts` 的
 * `Usage`），但在此之前前端連型別都沒有——`grep -rni "usage" src` 命中 0，
 * 使用者看不到任何數字。
 *
 * 🔴 擺在 footer、失敗橫幅之下、輸入框之上——跟 `ChatFailure` 同一層、
 * 同一套「這一輪發生了什麼」的位置，不是塞進某一則訊息裡：
 * 用量是**這一輪**的讀數，不是那一則訊息本身的屬性（供應商論的是整個請求，
 * 不是單一則）。沒有用量就不畫，不要留一條空白。
 */
export function UsageReadout({ usage }: { usage: Usage | null }) {
  if (!usage) return null;
  const text = formatUsage(usage);
  if (!text) return null;
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      align="center"
      sx={{ display: 'block', py: 0.5 }}
    >
      {text}
    </Typography>
  );
}
