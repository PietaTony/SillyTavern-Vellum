import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { backgroundUrl, type Fitting, fittingStyle } from '../model';

/**
 * 選背景時的**即時預覽**（Peter 2026-08-27：「背景設定的那個 modal 完全看不到
 * 修正的狀態」）。
 *
 * 🔴 **他提的「把 modal 弄成全透明」會更看不到，而且會看到假的：**
 *   ① 使用者真正看到的**不是整片原圖** —— `Screen` 在有背景時會把內容那一欄改成
 *      `alpha(background.default, .72)` ＋ `blur(2px)`（見 `Screen.tsx`）。
 *      透過透明的 modal 看到的是原圖，那不是「修正後的狀態」，是另一種假的。
 *   ② MUI `Dialog` 自己還有一層 backdrop 遮罩，透明 paper 底下仍然是被壓暗的圖。
 *   ③ 縮圖格與說明文字疊在任意照片上會讀不到 —— 尤其淺色圖。
 * ⇒ 改成**在層裡放一個真實比例的取景框**：看得到、讀得到、而且不必關掉層。
 *
 * 🔴 **用同一支 `fittingStyle()`**。那支的檔頭已經寫過這條理由：
 * 「縮圖與大圖共用同一組規則 —— 縮圖若用不同的裁切方式，選出來的結果就會與預期不符」。
 * 預覽框是第三個使用者，同一條理由。
 *
 * 🔴 **框裡要疊那一欄半透明的內容**，不是只顯示圖。
 * 真正要判斷的問題是「字壓在圖上讀不讀得到」，只看裁切判斷不出來。
 */
export function BackgroundPreview({
  name,
  fitting,
}: {
  name?: string | undefined;
  fitting: Fitting;
}) {
  /*
   * 🔴 **比例與欄寬照現在這個視窗算**，不寫死手機比例 ——
   * 桌機上那一欄只佔中間 `sm`（600px），兩側整片露出圖；手機上是滿版。
   * 兩者的觀感差很多，而使用者要判斷的是**他自己這一台**看起來如何。
   * ⚠️ 開著層的時候改視窗大小不會重算 —— 那是罕見動作，不值得為它掛一個 resize 監聽。
   */
  const vw = typeof window === 'undefined' ? 390 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 844 : window.innerHeight;
  const colPct = Math.min(1, 600 / vw) * 100;

  if (!name)
    return (
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          py: 3,
          textAlign: 'center',
          bgcolor: 'action.hover',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          還沒有背景 —— 選一張下面的圖，這裡會即時顯示套用後的樣子。
        </Typography>
      </Box>
    );

  return (
    <Box
      aria-label="套用後的預覽"
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${vw} / ${vh}`,
        maxHeight: 220,
        mx: 'auto',
        borderRadius: 1,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
      }}
    >
      {/* 🔴 檔名直接進 `url("…")` 的安全前提見 `BackgroundCanvas` 檔頭。 */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("${backgroundUrl(name)}")`,
          ...fittingStyle(fitting),
        }}
      />
      {/* 內容那一欄 —— 與 `Screen` 用同一組值，不是「看起來差不多」。 */}
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center' }}>
        <Box
          sx={{
            width: `${colPct}%`,
            bgcolor: (t) => alpha(t.palette.background.default, 0.72),
            backdropFilter: 'blur(2px)',
            p: 1,
          }}
        >
          <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600 }}>
            對話
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            字會像這樣壓在圖上面。
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
