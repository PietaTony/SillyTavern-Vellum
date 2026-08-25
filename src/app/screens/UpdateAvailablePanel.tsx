import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import {
  UPDATE_COMMAND,
  UPDATE_COMMAND_WHY,
  type UpdateInfo,
  UpdateNotes,
} from '@/features/update';
import { copyText } from '@/shared/lib/copyText';

/**
 * 有新版時的內容 —— 版號對照／release notes／複製指令。
 * 從 `UpdateCheckCard` 拆出來，單純是因為湊一起會超過 150 行上限。
 *
 * 🔴 複製指令與「為什麼不能一鍵」那段直接照抄 `UpdateBanner` 的邏輯
 * （同一份 `UPDATE_COMMAND`／`UPDATE_COMMAND_WHY`），不重新設計文案 —— 兩處講的是同一件事。
 */
export function UpdateAvailablePanel({ info }: { info: UpdateInfo }) {
  const [copied, setCopied] = useState(false);
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2">
        新版本 <strong>{info.latest}</strong>（目前 {info.current}）
      </Typography>

      <UpdateNotes notes={info.notes} breaking={info.breaking} />

      <Box
        component="code"
        sx={{
          fontFamily: 'vellum.fontMono',
          fontSize: 12,
          bgcolor: 'vellum.surfaceSunk',
          p: 1,
          borderRadius: 1,
          wordBreak: 'break-all',
        }}
      >
        {UPDATE_COMMAND}
      </Box>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <Button
          size="small"
          variant="outlined"
          sx={{ whiteSpace: 'nowrap' }}
          onClick={() => void copyText(UPDATE_COMMAND).then(setCopied)}
        >
          {copied ? '已複製' : '複製指令'}
        </Button>
        {/* 🔴 為什麼不能一鍵 —— 說清楚，不要讓人覺得只是懶得做（照抄 UpdateBanner） */}
        <Tooltip title={UPDATE_COMMAND_WHY} enterTouchDelay={0} leaveTouchDelay={8000} arrow>
          <IconButton size="small" aria-label="為什麼不能一鍵更新">
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button
          size="small"
          endIcon={<OpenInNewIcon />}
          href={info.url}
          target="_blank"
          rel="noreferrer"
          sx={{ whiteSpace: 'nowrap' }}
        >
          完整說明
        </Button>
      </Stack>
    </Stack>
  );
}
