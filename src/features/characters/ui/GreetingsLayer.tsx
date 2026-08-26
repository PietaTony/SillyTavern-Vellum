import AddIcon from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { FullScreenLayer } from '@/shared/ui/FullScreenLayer';
import { GreetingRow } from './GreetingRow';

/**
 * 額外問候語的全螢層（Peter 2026-08-26 選「開全螢層編」＋「照抄 ST：給完整編輯」）。
 *
 * 控制項照抄 ST 的彈窗（實查 `public/script.js:9470-9690`）：
 * 新增、刪除、上移下移、就地編輯、序號、空清單提示。
 * 🔴 **刪除要跳確認**（照抄 ST 的 `POPUP_TYPE.CONFIRM`，Peter 2026-08-26 確認要加）。
 * 一則問候語可能是上千字、而且**沒有復原**：按下送出之後就真的沒了。
 * ⚠️ 這個確認框是 `Dialog` 疊在 `FullScreenLayer` 上 —— **與「層內多級導覽不可以開第二個
 * Dialog」不衝突**：那條講的是「同一份內容的下一級」（✕ 會關錯層），
 * 這裡是**模態確認**，只有兩個出口而且都會自己關掉。
 *
 * 🔴 **只操作 `draft`，不碰後端。** 匯入的角色要不要 PATCH、
 * 新建的角色要不要一起 POST，都由 `AddFriendScreen` 決定 ——
 * 這一層不需要知道那位角色存不存在。
 */
export function GreetingsLayer({
  open,
  onClose,
  greetings,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  /** 🔴 **不含第一則問候**（與 ST 的 `alternate_greetings` 同語意）。 */
  greetings: string[];
  onChange: (next: string[]) => void;
}) {
  /** 正在等待確認刪除的那一則。`null` ＝ 沒有。 */
  const [confirming, setConfirming] = useState<number | null>(null);
  const at = (i: number, v: string) => onChange(greetings.map((g, j) => (j === i ? v : g)));
  const remove = (i: number) => {
    onChange(greetings.filter((_g, j) => j !== i));
    setConfirming(null);
  };
  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= greetings.length) return;
    const next = [...greetings];
    // 兩個元素直接對調（ST 也是這樣做，`script.js:9642-9679`）。
    [next[i], next[j]] = [next[j] as string, next[i] as string];
    onChange(next);
  };

  return (
    <FullScreenLayer
      open={open}
      title={`額外問候語（${greetings.length}）`}
      onClose={onClose}
      action={
        <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...greetings, ''])}>
          新增
        </Button>
      }
    >
      <Stack spacing={2.5}>
        <Typography variant="body2" color="text.secondary">
          進入對話後，這些會變成第一則訊息的左右候選。第一則問候語在上一頁的「初始訊息」欄。
        </Typography>
        {greetings.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            還沒有額外問候語。用右上角的「新增」加一則。
          </Typography>
        ) : null}
        {greetings.map((g, i) => (
          <GreetingRow
            // 🔴 **key 用 index 是刻意的。** 這個陣列沒有 id，而排序就是「內容換位置」——
            // 用內容當 key 的話兩則一模一樣就會撞，用 index 反而穩定。
            // biome-ignore lint/suspicious/noArrayIndexKey: 見上
            key={i}
            index={i}
            total={greetings.length}
            value={g}
            onChange={(v) => at(i, v)}
            onMove={(d) => move(i, d)}
            onDelete={() => setConfirming(i)}
          />
        ))}
      </Stack>

      <Dialog open={confirming !== null} onClose={() => setConfirming(null)}>
        <DialogTitle>刪掉第 {(confirming ?? 0) + 1} 則？</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {/* 🔴 講清楚「還救得回來嗎」——關掉不送出就等於取消，但送出之後沒有復原。 */}
            現在還沒送出，關掉這一頁就不會生效。按下「加入好友」之後就沒有復原了。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(null)}>取消</Button>
          <Button color="error" onClick={() => remove(confirming ?? 0)}>
            刪掉
          </Button>
        </DialogActions>
      </Dialog>
    </FullScreenLayer>
  );
}
