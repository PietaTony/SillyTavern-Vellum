import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

/**
 * `/worlds` 最上面那塊機制說明（Peter 指名要有）。
 *
 * 🔴 世界書最容易被誤解的兩件事，兩件都要講：
 * ① 不是「寫了就會送進去」——**要嘛常駐、要嘛命中關鍵字**
 * ② 這一層之外還有三層，四層是**疊加**不是覆蓋
 * 不講的話，使用者會寫一堆東西然後奇怪為什麼模型沒反應。
 */
export function GlobalWorldIntro() {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
      <Typography variant="subtitle2">這一頁的書會套用到你所有的對話</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        每一條有兩種進場方式：<b>常駐</b>（每一輪都送進去）或<b>關鍵字</b>
        （對話裡出現才送）。<b>沒開的條目完全不會被送出</b>。
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        世界書一共四層：<b>全域</b>（這裡）、這位好友、我（persona）、這段對話。 四層是
        <b>疊加</b>不是覆蓋 —— 同時命中就會一起送進去，靠「順序」決定誰先。
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        某位好友自己的世界書<b>不在這裡</b> —— 在對話裡點他的頭像 →「世界書」。
      </Typography>
    </Paper>
  );
}
