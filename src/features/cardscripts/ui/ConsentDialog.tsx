import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { Inventory } from '../api';
import { VENDOR_HOSTS } from '../runtime/preamble';

/**
 * 「要讓這張卡執行它自己的程式嗎？」（M13 第二期 ⑥c）。
 *
 * 🔴 **文案講我們實際的風險，不照抄 ST。** ST 只說「有嵌入式腳本，是否啟用」——
 * 等於沒說。我們寫得出來的實話是：
 *   · 讀得到**這一段**對話（介面本來就要靠它畫東西）
 *   · **送得出去**（沙箱擋讀不擋送，驗收單 ⓪）—— 所以我們把外連鎖進白名單
 *   · **讀不到其他角色的對話**（沙箱是獨立來源 ＋ 後端零 CORS，`noCors.test.ts` 釘住）
 *   · **拿不到 API 金鑰**（金鑰在後端，`/api/secrets` 只回布林）
 * ⚠️ 不要嚇唬使用者說「會偷金鑰」——那對我們不成立，而假的警告會讓真的警告失效。
 *
 * 🔴 **同意綁「這張卡的這個版本」**（`hash`），不是綁這張卡。卡片更新 ⇒ 指紋變 ⇒ 重問。
 *
 * 🔴 **兩種程式要分開講**：一種是**訊息裡看得到、你會直接點**的介面，
 * 另一種是**背景腳本**（桌寵、變數、世界書連動）—— 它們在你沒看的時候也在跑。
 * 混成一句「有 10 支腳本」會讓使用者不知道自己授權了什麼。
 */

const kb = (n: number) => (n < 1024 ? `${n} 字元` : `${Math.round(n / 1024).toLocaleString()} KB`);

export function ConsentDialog({
  open,
  inventory,
  characterName,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  inventory: Inventory;
  characterName: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const faces = inventory.scripts.filter((s) => s.kind === 'interface');
  const background = inventory.scripts.filter((s) => s.kind !== 'interface');
  /**
   * 🔴 **同一個網域只能出現一次。** 卡片要去的與我們自己要去的常常是同一個 CDN，
   * 列兩次會讓使用者以為那是兩條不同的外連 —— 清單長度本身就是他判斷風險的依據。
   */
  const cardHosts = new Set(inventory.scripts.flatMap((s) => s.externals));
  const hosts = [...new Set([...cardHosts, ...VENDOR_HOSTS])].sort().map((h) => ({
    host: h,
    why: [
      cardHosts.has(h) ? '卡片自己要去抓程式' : '',
      VENDOR_HOSTS.includes(h) ? 'Vellum 去抓 jQuery／toastr' : '',
    ]
      .filter(Boolean)
      .join('、'),
  }));

  const list = (items: typeof faces) => (
    <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.25 } }}>
      {items.map((s) => (
        <Typography component="li" variant="body2" color="text.secondary" key={s.name}>
          {s.name} · {kb(s.bytes)}
          {s.enabled ? '' : '（卡片作者標為關閉）'}
        </Typography>
      ))}
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>要讓「{characterName}」執行它自己的程式嗎？</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {faces.length > 0 ? (
            <Box>
              <Typography variant="subtitle2">現在就會跑的：{faces.length} 份互動介面</Typography>
              {list(faces)}
            </Box>
          ) : null}

          {background.length > 0 ? (
            <Box>
              <Typography variant="subtitle2">在背景跑的：{background.length} 支腳本</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                看不見的那一半 —— 桌面寵物、變數、世界書連動。
                <b>你沒在看畫面的時候它們也在跑</b>（例如桌寵會自己冒話）。
              </Typography>
              {list(background)}
            </Box>
          ) : null}

          <Alert severity="warning" icon={false}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              它會拿到什麼
            </Typography>
            <Typography variant="body2">
              <b>讀得到你和這個角色的這一段對話</b>（介面要靠它畫出選項）， 而且
              <b>可以把內容送到下面那些網域</b>。
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              它<b>讀不到你其他角色的對話</b>，也<b>拿不到你的 API 金鑰</b>（金鑰存在後端）。
            </Typography>
          </Alert>

          <Box>
            <Typography variant="subtitle2">會連出去的網域</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              同意之後，這份程式<b>只能連到這幾個網域</b>，其餘一律擋掉：
            </Typography>
            <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
              {hosts.map((h) => (
                <Typography component="li" variant="body2" key={h.host}>
                  <code>{h.host}</code> —— {h.why}
                </Typography>
              ))}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              ⚠️ 這些網域上的程式<b>在對方手上，隨時可能改</b>。我們記得住「這張卡沒變」，
              記不住「那個網址吐出來的東西沒變」。
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          先不要
        </Button>
        <Button variant="contained" onClick={onConfirm} disabled={busy}>
          執行這張卡的程式
        </Button>
      </DialogActions>
    </Dialog>
  );
}
