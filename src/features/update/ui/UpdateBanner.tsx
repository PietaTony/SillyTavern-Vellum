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
import { useDraft } from '@/shared/lib/useDraft';
import { fetchUpdate } from '../api';

const CMD = 'docker compose pull && docker compose up -d';

const WHY = `為什麼不是按一下就更新完：容器沒辦法自己換掉自己的 image。
要做到真正的一鍵，得把 docker.sock 掛進容器 —— 那等同把主機的 root 權限交出去，
為了省一次貼上不值得。
另一個理由：更新前你應該先看過這一版改了什麼。`;

/**
 * 有新版時告訴使用者 —— **只通知，不自動更新**。
 *
 * 🔴 這個立場有依據：同類最大的專案 Open WebUI 官方文件明確反對自動更新，
 * 理由是版本一旦帶破壞性變更或資料遷移，會在使用者不知情時弄壞他的部署。
 *
 * 🔴 關掉是**記在這一版**：下一版出來會再提醒一次，不會從此消失。
 */
export function UpdateBanner() {
  const q = useQuery({
    queryKey: ['update'],
    queryFn: fetchUpdate,
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });
  const [dismissed, setDismissed] = useDraft<string>('vellum.update.dismissed', '');
  const [copied, setCopied] = useState(false);

  const info = q.data;
  // 查不到就安靜 —— 離線是本機 app 的常態，不是要吵使用者的事
  if (!info?.updateAvailable || !info.latest) return null;
  if (dismissed === info.latest) return null;

  const copy = async () => {
    setCopied(await copyText(CMD));
  };

  return (
    <Alert severity="info" sx={{ mb: 2 }} onClose={() => setDismissed(info.latest ?? '')}>
      <Stack spacing={1}>
        <Typography variant="body2">
          有新版本 <strong>{info.latest}</strong>（你在 {info.current}）
        </Typography>

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
            onClick={() => void copy()}
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
            這一版改了什麼
          </Button>
        </Stack>
      </Stack>
    </Alert>
  );
}
