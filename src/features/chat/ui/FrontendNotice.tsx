import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * 「這張卡帶了它自己的互動介面」的引導卡（M13 第一期 ⑤d，第二期補上按鈕）。
 *
 * 🔴 **為什麼不是直接把那段 HTML 印出來**：實測 ST 關掉套件時就是那樣——
 * 使用者看到一大塊語法高亮的原始碼（M13 步驟③ 的截圖）。
 * 更糟的是那張卡的說明文字**還在教使用者去點「線卡」「前往此場景」**，
 * 而那些控制項在我們這裡根本不存在 ⇒ **那是一份騙人的說明書**。
 *
 * 🔴 **文案講的是我們實際的風險**（M13 安全邊界 ⓪ 量過）：
 * 卡片程式關在沙箱裡 ⇒ **讀不到其他角色的對話**、**拿不到金鑰**（存在後端）。
 * 它讀得到的是**這一段**對話，而且送得出去 —— 所以同意視窗要把外連鎖進白名單。
 * ⚠️ 不要嚇唬使用者說會被偷金鑰，那是假的；假的警告會讓真的警告失效。
 *
 * 🔴 **`onEnable` 沒給就不畫按鈕。** 判準是「按下去有沒有東西接」：
 * 沒有執行環境／沒有可同意的盤點資料時畫鈕，就是這個 repo 反覆踩的「說謊的按鈕」。
 */
export function FrontendNotice({
  bytes,
  onEnable,
}: {
  bytes: number;
  onEnable?: (() => void) | undefined;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, my: 1, bgcolor: 'action.hover' }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <ExtensionOutlinedIcon fontSize="small" sx={{ mt: 0.25, color: 'text.secondary' }} />
        <Box>
          <Typography variant="subtitle2">這張卡帶了它自己的互動介面</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            這則訊息裡有一段 {bytes.toLocaleString()} 字元的網頁程式，是卡片作者寫的 —— 在
            SillyTavern 裡它會變成可以點的選單。
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            我們還沒有執行它。要執行的話，那段程式會
            <Box component="span" sx={{ fontWeight: 600 }}>
              {' '}
              讀得到你和這個角色的這一段對話
            </Box>
            ；它讀不到你其他角色的對話，也拿不到你的 API 金鑰。
          </Typography>
          {onEnable ? (
            <Button size="small" variant="outlined" sx={{ mt: 1 }} onClick={onEnable}>
              看看它會做什麼
            </Button>
          ) : null}
        </Box>
      </Stack>
    </Paper>
  );
}
