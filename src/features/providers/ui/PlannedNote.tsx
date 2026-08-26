import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';

/**
 * `planned` 的那幾家：**說明「還缺什麼」，不是只說「還沒做」。**
 *
 * 🔴 使用者要看得出這是**我們的工作量**，不是他哪裡設定錯了。
 * 只寫「還沒做」的話，他會反覆回來試，以為是自己漏了步驟。
 */
const MISSING: Record<string, string> = {
  azure_openai:
    '需要你自己的 endpoint 與 deployment 名稱 —— 那兩個欄位還沒做，只有 API key 是不夠的。',
  custom: '需要讓你自己填 base URL —— 那個欄位還沒做。',
  workers_ai: '網址裡要帶你的 Cloudflare account id —— 那個欄位還沒做。',
  vertexai: 'Vertex AI 走 GCP 服務帳號而不是 API key，認證方式與其他家不同，還沒實作。',
};

export function PlannedNote({ id }: { id: string }) {
  return (
    <Alert severity="info">
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        這一家還缺什麼
      </Typography>
      <Typography variant="caption" component="div">
        {MISSING[id] ?? '介面還沒接上。'}
      </Typography>
    </Alert>
  );
}
