import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  DESKTOP_UPDATE_STEPS,
  DESKTOP_UPDATE_WHY,
  RELEASES_URL,
  UPDATE_STEPS,
  UPDATE_WHY,
} from '../updateSteps';

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
export function UpdateSteps({
  notesUrl,
  native = false,
}: {
  notesUrl?: string | undefined;
  /** 🔴 桌面安裝版由 Electron 原生更新器接手 ⇒ 手動搬 `data/` 那三步對他們是錯的指示。 */
  native?: boolean;
}) {
  const steps = native ? DESKTOP_UPDATE_STEPS : UPDATE_STEPS;
  return (
    <Stack spacing={1}>
      <Stack component="ol" spacing={0.5} sx={{ pl: 2.5, my: 0 }}>
        {steps.map((step, i) => (
          <Typography key={step} component="li" variant="body2" color="text.secondary">
            {/* 非桌面版的第 2 步（搬 data/）是全部的重點；桌面版沒有那一步要強調 */}
            {!native && i === 1 ? <b>{step}</b> : step}
          </Typography>
        ))}
      </Stack>

      <Stack
        direction="row"
        spacing={0.5}
        sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
      >
        {/* 🔴 桌面版不放「開啟下載頁」—— 那顆會把人帶去手動下載一份，
            結果是電腦裡兩份 Vellum，而更新器還在等他按「下載並更新」。 */}
        {native ? null : (
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
        )}
        {/* 🔴 為什麼不能一鍵 —— 說清楚，不要讓人覺得只是懶得做。桌面版改成講何時會查。 */}
        <Tooltip
          title={native ? DESKTOP_UPDATE_WHY : UPDATE_WHY}
          enterTouchDelay={0}
          leaveTouchDelay={8000}
          arrow
        >
          <IconButton size="small" aria-label={native ? '更新是怎麼運作的' : '為什麼不能一鍵更新'}>
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
