import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { FullScreenLayer } from '@/shared/ui/FullScreenLayer';
import { fetchCardVariableSchema, fetchChat } from '../api';
import { schemaRows, variableRows } from '../variablesView';

/**
 * D2：對話頁 ☰ →「變數」。**唯讀**面板 —— 兩塊：目前值 ＋ 卡片宣告的 schema。
 *
 * 🔴 schema 那一塊曾經缺席（後端沒有端點）——H6 補了
 * `GET /api/card-variables/:characterId/schema`（`server/routes/cardVariables.ts:56-67`）
 * 之後這裡才接得上。**只畫「宣告了哪些變數」**（名字／型別／初始值／是否唯讀），
 * **不畫 `constraints`**：那是引擎寫死套在所有數字變數上的規則，跟卡片宣告無關，
 * 畫出來會讓人誤以為是這張卡自訂的（理由與型別對齊細節見 `../variablesView.ts` 的
 * `schemaRows`）。
 *
 * 🔴 **不接「編輯變數」的控制項**：寫入路徑（`PATCH /api/chats/:id/variables`）
 * 是通的沒錯，但這張卡的變數多半是卡片腳本／生成流程自己在管的狀態
 * （安全感、面具、親密度…），使用者從這裡手滑改一個數字，下一輪生成的
 * `<UpdateVariable>` 又會用模型自己的認知蓋回去 —— 那是「看起來有用、其實沒用」
 * 的另一種形狀。這一版先求「看得到」，「改得了」留給之後有清楚判準時再做。
 * schema 這一塊本來就是**唯讀宣告**，不會有寫入路徑。
 *
 * 🔴 用跟主畫面同一個 `['chat', chatId]` query key —— 面板打開時多半直接吃
 * React Query 的快取（主畫面已經在讀這段對話），不必自己另開一份會跟主畫面
 * 對不上的複本。schema 查詢則另開一個 key，等 `chat.data.characterId` 到位才 enable
 * （角色 id 要從 chat 查詢先拿到，兩支不是平行的）。
 *
 * 🔴 **`schema: null` 是正常空狀態，不是錯誤** —— 角色沒有卡片檔／卡片沒有
 * `[initvar]` 條目／PNG 不是卡片，三種原因收斂成同一個值（`api.ts` 的
 * `fetchCardVariableSchema` 檔頭）。這裡用獨立的「這張卡沒有宣告變數」文案，
 * 跟 `schemaQuery.isError`（非 2xx，讀不到）分開判斷，不要混在一起。
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
  const characterId = chat.data?.characterId;
  const schemaQuery = useQuery({
    queryKey: ['cardVariableSchema', characterId],
    queryFn: () => fetchCardVariableSchema(characterId ?? ''),
    enabled: open && Boolean(characterId),
  });
  const rows = variableRows(chat.data?.variables);
  const declared = schemaRows(schemaQuery.data?.schema);

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

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        這張卡宣告的變數
      </Typography>
      {schemaQuery.isPending && characterId ? <CircularProgress size={24} /> : null}
      {schemaQuery.isError ? (
        <Typography variant="body2" color="error">
          讀不到這張卡的變數宣告。
        </Typography>
      ) : null}
      {schemaQuery.isSuccess && declared.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          這張卡沒有宣告任何變數。
        </Typography>
      ) : null}
      {declared.length > 0 ? (
        <List disablePadding>
          {declared.map((r) => (
            <ListItem key={r.label} divider>
              <ListItemText
                primary={`${r.label}${r.readonly ? '（唯讀）' : ''}`}
                secondary={`${r.type} · 初始值 ${r.initial}`}
              />
            </ListItem>
          ))}
        </List>
      ) : null}
    </FullScreenLayer>
  );
}
