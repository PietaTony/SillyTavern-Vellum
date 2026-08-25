import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { relativeTime } from '@/features/chat';
import type { UpdateInfo } from '@/features/update';
import { UpdateAvailablePanel } from './UpdateAvailablePanel';

/**
 * 「關於與更新」的主要內容 —— 目前版本、手動檢查、與三種互斥結果。
 *
 * 🔴 三種結果**文案刻意分得開**（Peter 需求 U-D3 的延伸）：
 * 「查不到」≠「已是最新版」。查不到卻顯示成已確認最新，會讓人以為已經查過沒事，
 * 實際上這次根本沒查到 GitHub。
 */
export function UpdateCheckCard({
  info,
  checking,
  onCheck,
}: {
  info: UpdateInfo | undefined;
  checking: boolean;
  onCheck: () => void;
}) {
  if (!info) return <CircularProgress size={24} />;

  const hasNewVersion = info.updateAvailable && Boolean(info.latest);

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="body2">
          目前版本 <strong>{info.current}</strong>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          上次檢查：{relativeTime(new Date(info.checkedAt).toISOString(), new Date())}
        </Typography>
      </Stack>

      <Button
        size="small"
        variant="outlined"
        startIcon={checking ? <CircularProgress size={14} /> : <RefreshIcon />}
        disabled={checking}
        onClick={onCheck}
        sx={{ alignSelf: 'flex-start' }}
      >
        {checking ? '檢查中…' : '檢查更新'}
      </Button>

      {info.error ? (
        <Alert severity="warning" icon={<ReportProblemOutlinedIcon fontSize="small" />}>
          這次查不到最新版本：{info.error}
          {/* 🔴 這句是重點：查不到不等於已確認最新，不要讓人誤會已經查過沒事 */}
          <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
            這不代表目前已經是最新版，只是這次沒查成功，可以稍後再試。
          </Typography>
        </Alert>
      ) : hasNewVersion ? (
        <UpdateAvailablePanel info={info} />
      ) : (
        <Alert severity="success" icon={<CheckCircleOutlineIcon fontSize="small" />}>
          已是最新版本
        </Alert>
      )}
    </Stack>
  );
}
