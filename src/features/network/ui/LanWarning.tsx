import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AUTH_QUERY } from '../authApi';
import { hostKind } from '../hostKind';
import { NoLoginWarning } from './NoLoginWarning';

/**
 * 給**連進來的那一台**看的警告（Peter 2026-08-27）。
 *
 * 🔴 **走區網進來 ≠ 走 Tailscale 進來** —— 文案要跟 `NetworkCard` 一致，
 * 已設存取密碼時不能還說「沒有登入機制」（見 `NoLoginWarning` 唯一正本）。
 */
export function LanWarning() {
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const onLan = hostKind(window.location.hostname) === 'lan';
  const auth = useQuery({ ...AUTH_QUERY, enabled: onLan && !gone });
  if (gone || !onLan) return null;

  const hasPassword = auth.data?.hasPassword ?? false;

  return (
    <Alert severity="warning" square sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <AlertTitle sx={{ mb: 0 }}>你是走區域網路連進來的，不是 Tailscale</AlertTitle>
      <Typography variant="body2">
        <NoLoginWarning hasPassword={hasPassword} />而<b>同一個 wifi 上的人都連得到這個網址</b>
        （室友、訪客、被入侵的裝置）。
      </Typography>
      <Box sx={{ mt: 1 }}>
        <Button size="small" onClick={() => setOpen(!open)} endIcon={<ExpandMoreIcon />}>
          怎麼改走 Tailscale
        </Button>
        <Button size="small" onClick={() => setGone(true)}>
          知道了
        </Button>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Typography variant="body2" component="ol" sx={{ pl: 2.5, m: 0, mt: 1 }}>
          <li>這台裝置與跑 Vellum 的那台電腦，都安裝 Tailscale 並登入同一個帳號</li>
          <li>在電腦上開 Vellum → 設定 → 其他裝置，抄那條標著「Tailscale」的網址</li>
          <li>在這台裝置改用那條網址（開頭是 100.）</li>
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
          電腦上找不到那條網址的話，就是 Tailscale 沒有在它上面跑。
        </Typography>
      </Collapse>
    </Alert>
  );
}
