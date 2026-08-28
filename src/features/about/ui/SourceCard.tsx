import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { AboutInfo } from '../api';

/**
 * 「取得原始碼」—— **AGPL-3.0 §13 的履行入口，不是關於頁的裝飾**。
 *
 * 🔴 §13：把修改過的版本架起來讓別人透過網路使用，
 * **就必須讓那些使用者取得對應的原始碼**。義務在**營運方**身上，不在作者身上。
 * ⇒ 所以連結指向的是「這個站台宣告的位置」（`VELLUM_SOURCE_URL`），
 * 預設才是我們的 repo。寫死我們的 repo 會讓改過的站台**看起來履行了、其實沒有**。
 *
 * 🔴 **文案要說得出「這是誰宣告的」** —— 我們驗證不了那個網址真的放著對應版本的原始碼，
 * 也不該假裝驗證得了。說成「原始碼在這裡」是替營運者背書；
 * 說成「這個站台宣告原始碼在這裡」才是我們知道的事。
 *
 * 🔴 **桌面版也要有這一塊** —— Electron 那個視窗載入的是同一個前端，所以自動就有。
 * 打包產物內另外帶一份 `LICENSE` 全文（`scripts/package-zip.ts`／`electron-builder.yml`）。
 */
export function SourceCard({ info }: { info: AboutInfo | undefined }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">原始碼與授權</Typography>

        <Typography variant="body2" color="text.secondary">
          Vellum 是自由軟體，授權 <b>{info?.license ?? 'AGPL-3.0-or-later'}</b>。
          你有權取得它的完整原始碼、修改它、再散布它。
        </Typography>

        <Typography variant="body2" color="text.secondary">
          它是 <b>SillyTavern</b> 的分支（fork）—— 後端以 Hono 重寫，前端整個重寫。
        </Typography>

        {/* 🔴 「這個站台宣告」不是囉嗦，是我們唯一說得出口的事實。 */}
        <Typography variant="body2" color="text.secondary">
          這個站台宣告它的原始碼在下面這個位置。
          <b>如果你把改過的版本架給別人用，這個連結要換成你自己的原始碼位置</b>
          （設定 <code>VELLUM_SOURCE_URL</code>）—— 那是 AGPL 對營運方的要求。
        </Typography>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            endIcon={<OpenInNewIcon />}
            href={info?.source ?? 'https://github.com/PietaTony/SillyTavern-Vellum'}
            target="_blank"
            rel="noreferrer"
            sx={{ whiteSpace: 'nowrap' }}
          >
            取得原始碼
          </Button>
          <Button
            size="small"
            endIcon={<OpenInNewIcon />}
            href={info?.upstream ?? 'https://github.com/SillyTavern/SillyTavern'}
            target="_blank"
            rel="noreferrer"
            sx={{ whiteSpace: 'nowrap' }}
          >
            上游 SillyTavern
          </Button>
          <Button
            size="small"
            endIcon={<OpenInNewIcon />}
            href="https://www.gnu.org/licenses/agpl-3.0.html"
            target="_blank"
            rel="noreferrer"
            sx={{ whiteSpace: 'nowrap' }}
          >
            授權全文
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
