import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { FullScreenLayer } from '@/shared/ui/FullScreenLayer';
import { fetchChat } from '../api';
import { variableRows } from '../variablesView';

/**
 * D2：對話頁 ☰ →「變數」。**唯讀**面板 —— 目前這段對話的變數值。
 *
 * 🔴 **這一版只有「值」，沒有「卡片宣告的 schema」那一塊。**
 * 原始需求要兩塊（目前值 ＋ 卡片宣告的 schema，唯讀），但後端沒有任何端點會回傳
 * 卡片宣告的變數清單 —— `deriveConfig`／`schemaOf` 只在伺服器內部用，沒有路由把它端出來。
 * 補一支屬於 H6 的 `cardVariables.ts`，或另開新路由掛上 `server/app.ts`（X3，
 * 登記新路由本身就要 ticket）都不是這次能單層動手的範圍，回報裡有寫。
 * ⇒ 總則五：不畫引擎不支援的東西，這裡就先不畫 schema 那一塊。
 *
 * 🔴 **不接「編輯變數」的控制項**：寫入路徑（`PATCH /api/chats/:id/variables`）
 * 是通的沒錯，但這張卡的變數多半是卡片腳本／生成流程自己在管的狀態
 * （安全感、面具、親密度…），使用者從這裡手滑改一個數字，下一輪生成的
 * `<UpdateVariable>` 又會用模型自己的認知蓋回去 —— 那是「看起來有用、其實沒用」
 * 的另一種形狀。這一版先求「看得到」，「改得了」留給之後有清楚判準時再做。
 *
 * 🔴 用跟主畫面同一個 `['chat', chatId]` query key —— 面板打開時多半直接吃
 * React Query 的快取（主畫面已經在讀這段對話），不必自己另開一份會跟主畫面
 * 對不上的複本。
 */
export function VariablesLayer({
  open,
  onClose,
  chatId,
}: {
  open: boolean;
  onClose: () => void;
  chatId: string;
}) {
  const chat = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => fetchChat(chatId),
    enabled: open,
  });
  const rows = variableRows(chat.data?.variables);

  return (
    <FullScreenLayer open={open} title="變數" onClose={onClose}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        這段對話目前的變數值，唯讀。由卡片腳本或生成過程寫入。
      </Typography>
      {chat.isPending ? <CircularProgress size={24} /> : null}
      {chat.isError ? (
        <Typography variant="body2" color="error">
          讀不到這段對話的變數。
        </Typography>
      ) : null}
      {chat.isSuccess && rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          這段對話還沒有任何變數。
        </Typography>
      ) : null}
      {rows.length > 0 ? (
        <List disablePadding>
          {rows.map((r) => (
            <ListItem key={r.label} divider>
              <ListItemText primary={r.label} secondary={r.value} />
            </ListItem>
          ))}
        </List>
      ) : null}
    </FullScreenLayer>
  );
}
