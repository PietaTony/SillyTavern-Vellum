import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { fetchBindings, LayerTable } from '@/features/worldbook';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/worlds/bindings')({ component: BindingsPage });

/**
 * 四層綁定總覽（階段八 C4）。回答的是「**為什麼這條會進場、為什麼是這個順序**」。
 *
 * 🔴 四層裡**只有兩層真的接上了**（實查 `promptWorld.ts:43-46`：
 * `orderLayers` 只被餵 character 與 persona，global 與 chat 永遠是空的）。
 * 照規格總則五：**照樣列出來，但標「還沒接上」、不給綁。**
 */
function BindingsPage() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['worldBindings'], queryFn: fetchBindings });

  return (
    <Screen title="世界書怎麼套用" onBack={() => void nav({ to: '/worlds' })}>
      {q.isPending ? <CircularProgress size={24} /> : null}
      {q.isError ? (
        <Alert
          severity="warning"
          sx={{ m: 2 }}
          action={
            <Button size="small" onClick={() => void q.refetch()}>
              重新載入
            </Button>
          }
        >
          讀不到綁定總覽：{q.error instanceof Error ? q.error.message : ''}
        </Alert>
      ) : null}
      {q.data ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, pt: 2 }}>
            一段對話會同時吃到好幾層的世界書。由上往下是它們被選中的先後 ——
            預算不夠時，排在後面的先被裁掉。
          </Typography>
          <LayerTable layers={q.data.layers} />
          <Divider />

          <Typography variant="subtitle2" sx={{ px: 2, pt: 2 }}>
            這位好友那一本
          </Typography>
          <List disablePadding>
            {q.data.friends.map((f) => (
              <ListItemButton
                key={f.characterId}
                disabled={!f.ownWorldId}
                onClick={() => {
                  if (f.ownWorldId)
                    void nav({ to: '/worlds/$worldId', params: { worldId: f.ownWorldId } });
                }}
              >
                <ListItemText
                  primary={f.name}
                  secondary={
                    f.ownWorldId
                      ? `${f.ownEntryCount} 條`
                      : '這張卡沒有帶世界書 —— 不是沒設定，是卡片本來就沒有'
                  }
                />
              </ListItemButton>
            ))}
          </List>
          <Divider />

          <Typography variant="subtitle2" sx={{ px: 2, pt: 2 }}>
            我（persona）那一本
          </Typography>
          <List disablePadding>
            {q.data.personas.map((p) => (
              <ListItemButton key={p.id} onClick={() => void nav({ to: '/profile' })}>
                <ListItemText
                  primary={p.name}
                  secondary={p.lorebookId ? '有綁一本 —— 點這裡去換' : '沒有綁 —— 點這裡去選'}
                />
              </ListItemButton>
            ))}
          </List>
        </>
      ) : null}
    </Screen>
  );
}
