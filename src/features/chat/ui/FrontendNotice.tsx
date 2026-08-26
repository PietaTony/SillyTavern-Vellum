import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * 「這張卡帶了它自己的互動介面」的引導卡（M13 第一期 ⑤d）。
 *
 * 🔴 **為什麼不是直接把那段 HTML 印出來**：實測 ST 關掉套件時就是那樣——
 * 使用者看到一大塊語法高亮的原始碼（M13 步驟③ 的截圖）。
 * 更糟的是那張卡的說明文字**還在教使用者去點「線卡」「前往此場景」**，
 * 而那些控制項在我們這裡根本不存在 ⇒ **那是一份騙人的說明書**。
 * ⇒ 第一期先誠實：**說清楚這裡有東西、我們還沒跑它、跑它的代價是什麼。**
 *
 * 🔴 **文案講的是我們實際的風險，不是抄 ST 的說法**（M13 安全邊界 ⓪ 量過）：
 * 卡片腳本與這個 app 同源 ⇒ **讀得到全部對話、可以打生成端點花錢、可以改設定**。
 * **金鑰偷不走**（存在後端，`/api/secrets` 只回布林、`/preview` 只回遮罩）——
 * 所以不要嚇唬使用者說會被偷金鑰，那是假的。
 *
 * ⏸ 「啟用」那顆鈕是**第二期**的事（要連 iframe 宿主與卡片自帶腳本一起上，
 * 只做半套會換來一個空白／噴錯的畫面 —— `gemini-verify` 開的 BLOCKER ⑥）。
 * **在那之前這裡不畫按鈕** —— 畫一顆點了沒反應的鈕，就是這個 repo 反覆踩的「說謊的按鈕」。
 */
export function FrontendNotice({ bytes }: { bytes: number }) {
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
            我們還沒有執行它。要執行的話，那段程式會拿到跟這個 app 一樣的權限：
            <Box component="span" sx={{ fontWeight: 600 }}>
              {' '}
              讀得到你全部的對話、可以呼叫生成（會計費）、可以改設定
            </Box>
            。你的 API 金鑰存在後端，它拿不到。
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
