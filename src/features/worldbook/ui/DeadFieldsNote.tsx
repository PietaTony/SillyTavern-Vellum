import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { DEAD_FIELDS } from '../fields';
import type { WbEntry } from '../types';

/**
 * 🔴 **規格總則五：不准畫出引擎不支援的控制項。**
 *
 * 這些欄位卡片裡有、匯出時也原樣還在，但**沒有任何 code 讀它們**。
 * 畫成可編輯就是騙人 —— 使用者會調了、存了、以為有作用，
 * 而實際什麼都沒發生、且沒有任何跡象。
 *
 * 三選一（唯讀顯示／不顯示／標尚未生效）裡選最後一個：
 * **完全不顯示會讓人以為卡片的設定被我們吃掉了。**
 */
export function DeadFieldsNote({ value }: { value: WbEntry }) {
  const dead = DEAD_FIELDS.filter((f) => f.present(value));
  if (dead.length === 0) return null;
  return (
    <Alert severity="info" sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        這張卡有設定、但這一版還沒實作的
      </Typography>
      <Typography variant="caption" component="div" sx={{ mb: 1 }}>
        值原樣保留、匯出回 SillyTavern 不會遺失，但目前不會生效，所以這裡不給改。
      </Typography>
      {dead.map((f) => (
        <Typography key={f.key} variant="caption" component="div">
          · {f.label}：{f.show(value)}
        </Typography>
      ))}
    </Alert>
  );
}
