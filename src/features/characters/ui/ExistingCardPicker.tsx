import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  type Character,
  fetchCharacter,
  fetchCharacters,
  type ImportedCharacter,
  nameOf,
} from '../api';

/**
 * 從卡庫（已經匯入過的角色卡）挑一張，疊加在「加入好友」畫面最上方
 * （`design/screens.json` 的 `First-Run--6`，🔴 只在首次啟動流程顯示——
 * 老使用者在好友列表已經看得到這些卡，這裡不重複一份）。
 *
 * 🔴 **列表顯示 `displayName`，不是 `name`**（D-h，走 `nameOf`）：
 * 同一張卡可以加入多次，`name` 會全部一樣，選不了。
 *
 * 🔴 **一張卡都沒有時整塊不畫**——這是 first-run 的預設情況，
 * 不要顯示一個空的下拉（Peter 的要求）。
 *
 * 🔴 選項只帶 id，選中之後另外打 `fetchCharacter` 拿完整內容（含 `greetings`）——
 * 列表 API 刻意不回 `greetings`（見 `api.ts` 的 `CharacterSummary` 檔頭），
 * 沒有它 `draftOfCard` 會把額外問候語當空的，選了等於清空。
 */
export function ExistingCardPicker({ onPick }: { onPick: (c: ImportedCharacter) => void }) {
  const list = useQuery({ queryKey: ['characters'], queryFn: fetchCharacters });
  const detail = useMutation({
    mutationFn: fetchCharacter,
    /*
     * 🔴 `alternateGreetings`／`world` 是「這次匯入解鎖了幾條世界書」的資訊，
     * 從卡庫挑不存在「這次匯入」——兩個欄位在畫面上沒有任何地方讀，填 0 即可。
     */
    onSuccess: (c: Character) => onPick({ ...c, alternateGreetings: 0 }),
  });

  if (list.isPending) return <CircularProgress size={20} />;
  if (list.isError) {
    return (
      <Alert
        severity="warning"
        sx={{ mb: 2 }}
        action={
          <Button size="small" onClick={() => void list.refetch()}>
            重新載入
          </Button>
        }
      >
        讀不到卡庫：{list.error instanceof Error ? list.error.message : ''}
      </Alert>
    );
  }
  if (list.data.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <FormControl fullWidth size="small" disabled={detail.isPending}>
        <InputLabel id="existing-card-picker-label">從卡庫挑一張</InputLabel>
        <Select
          labelId="existing-card-picker-label"
          label="從卡庫挑一張"
          // 🔴 刻意不留住選中值——這是「挑了就套用」的動作選單，不是持久欄位。
          value=""
          onChange={(e) => {
            const id = e.target.value;
            if (id) detail.mutate(id);
          }}
        >
          {list.data.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                <Avatar src={c.avatar || undefined} sx={{ width: 24, height: 24 }}>
                  {nameOf(c).slice(0, 1)}
                </Avatar>
                <Typography noWrap>{nameOf(c)}</Typography>
              </Stack>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {detail.isPending ? (
        <Typography variant="caption" color="text.secondary">
          載入中…
        </Typography>
      ) : null}
      {detail.isError ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          讀不到這張卡：{detail.error instanceof Error ? detail.error.message : ''}
        </Alert>
      ) : null}
    </Box>
  );
}
