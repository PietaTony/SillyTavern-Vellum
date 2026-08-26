import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { RELEASES_URL, UPDATE_STEPS, UPDATE_WHY } from '../updateSteps';

/**
 * 「怎麼更新」—— 橫幅與設定頁共用同一份。
 *
 * 🔴 **畫面上不再有可複製的指令**（2026-08-27）。上一版顯示
 * `docker compose pull && docker compose up -d` 加一顆「複製指令」；
 * Docker 方案移除之後那條**永遠跑不起來**，而換成另一條指令只是換一個新的謊 ——
 * 走 zip 的使用者沒有 git、沒有 pnpm，這件事本來就沒有單行指令做得到。
 *
 * 🔴 **第 2 步要看得出比別步重要**：忘了搬 `data/` 就是「更新完什麼都不見了」，
 * 而畫面會顯示成正常的空狀態，看不出是災難。
 */
export function UpdateSteps({ notesUrl }: { notesUrl?: string | undefined }) {
  return (
    <Stack spacing={1}>
      <Stack component="ol" spacing={0.5} sx={{ pl: 2.5, my: 0 }}>
        {UPDATE_STEPS.map((step, i) => (
          <Typography key={step} component="li" variant="body2" color="text.secondary">
            {i === 1 ? <b>{step}</b> : step}
          </Typography>
        ))}
      </Stack>

      <Stack
        direction="row"
        spacing={0.5}
        sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
      >
        <Button
          size="small"
          variant="outlined"
          endIcon={<OpenInNewIcon />}
          href={RELEASES_URL}
          target="_blank"
          rel="noreferrer"
          sx={{ whiteSpace: 'nowrap' }}
        >
          開啟下載頁
        </Button>
        {/* 🔴 為什麼不能一鍵 —— 說清楚，不要讓人覺得只是懶得做。 */}
        <Tooltip title={UPDATE_WHY} enterTouchDelay={0} leaveTouchDelay={8000} arrow>
          <IconButton size="small" aria-label="為什麼不能一鍵更新">
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {notesUrl ? (
          <Button
            size="small"
            endIcon={<OpenInNewIcon />}
            href={notesUrl}
            target="_blank"
            rel="noreferrer"
            sx={{ whiteSpace: 'nowrap' }}
          >
            完整說明
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}
