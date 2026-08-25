import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { copyText } from '@/shared/lib/copyText';
import { fetchUpdate } from '../api';
import { UPDATE_COMMAND as CMD, UPDATE_COMMAND_WHY as WHY } from '../copyCommand';
import { UpdateNotes } from './UpdateNotes';

/**
 * 有新版時告訴使用者 —— **只通知，不自動更新**。
 *
 * 🔴 依據：同類最大的專案 Open WebUI 官方文件明確反對自動更新，
 * 理由是版本一旦帶破壞性變更或資料遷移，會在使用者不知情時弄壞他的部署。
 *
 * 🔴 **只有「稍後」，沒有「跳過這版」**（Peter 2026-08-25 裁定）。
 * 設計正本主張要有「跳過這版」，理由是看到破壞性變更想等一版的人不該只剩
 * 「更新」與「永遠被提醒」兩種選擇 —— **這條被 Peter 否決，以他為準**。
 * ⇒ 稍後＝這次不看，重新開啟還會再提醒。
 */
export function UpdateBanner() {
  const q = useQuery({
    queryKey: ['update'],
    queryFn: () => fetchUpdate(),
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });
  const [later, setLater] = useState(false);
  const [copied, setCopied] = useState(false);

  const info = q.data;
  // 查不到就安靜 —— 離線是本機 app 的常態，不是要吵使用者的事
  if (!info?.updateAvailable || !info.latest) return null;
  if (later) return null;

  return (
    <Alert severity={info.breaking ? 'warning' : 'info'} sx={{ mb: 2 }}>
      <Stack spacing={1}>
        <Typography variant="body2">
          有新版本 <strong>{info.latest}</strong>（你在 {info.current}）
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
          {CMD}
        </Box>

        {/* 🔴 手機寬度只有 ~360px：按鈕不加 nowrap 會被拆成兩行（實測） */}
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
        >
          <Button
            size="small"
            variant="outlined"
            sx={{ whiteSpace: 'nowrap' }}
            onClick={() => void copyText(CMD).then(setCopied)}
          >
            {copied ? '已複製' : '複製指令'}
          </Button>
          {/* 🔴 為什麼不能一鍵 —— 說清楚，不要讓人覺得只是懶得做 */}
          <Tooltip title={WHY} enterTouchDelay={0} leaveTouchDelay={8000} arrow>
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

        <Button
          size="small"
          color="inherit"
          sx={{ alignSelf: 'flex-start' }}
          onClick={() => setLater(true)}
        >
          稍後
        </Button>
      </Stack>
    </Alert>
  );
}
