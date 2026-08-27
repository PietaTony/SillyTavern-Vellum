import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import Button from '@mui/material/Button';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import { type ReportInput, reportNow } from '@/app/report';
import { copyText } from '@/shared/lib/copyText';
import { pushToast } from '@/shared/ui/toastStore';

/**
 * 「回報問題」——**把一張診斷單整包複製走**（Peter 2026-08-27：
 * 「我會希望他們有辦法回報東西給我，任何東西」）。
 *
 * 🔴 **為什麼是複製而不是送出**：這顆最需要出現的地方是「Vellum 沒有回應」那一頁，
 * 而那一刻任何靠我們自己端點的回報都是死的。複製不需要帳號、不需要我們的伺服器。
 * 單子裡有什麼、不能有什麼，見 `app/report.ts`。
 *
 * 🔴 **失敗要說出來。** `copyText` 在非安全來源（`http://100.x.x.x:18530` 就是）
 * 會退回 `execCommand`，兩條路都不通時要告訴他「請長按選取」，不是安靜地假裝成功。
 *
 * 三種長相是因為四個入口的容器不同（`Menu` 的項目／設定的清單列／一般按鈕），
 * 文案與行為完全一樣。tips 上那個入口不在這裡 —— 它沿用 tips 本來就有的複製鈕，
 * 只是把複製的內容換成整張回報單（見 `features/providers/failureToast.ts`）。
 */
function copyReport(input: ReportInput) {
  void copyText(reportNow(input)).then((ok) =>
    pushToast(
      ok
        ? { severity: 'success', text: '回報單已複製 —— 貼給我們，記得補一句你剛剛在做什麼' }
        : {
            severity: 'warning',
            text: '這個瀏覽器不讓我複製 —— 請長按選取畫面上的錯誤訊息',
          },
    ),
  );
}

export function ReportButton({ input, onDone }: { input?: ReportInput; onDone?: () => void }) {
  return (
    <Button
      size="small"
      color="inherit"
      startIcon={<BugReportOutlinedIcon />}
      onClick={() => {
        copyReport(input ?? {});
        onDone?.();
      }}
    >
      回報問題
    </Button>
  );
}

export function ReportMenuItem({ input, onDone }: { input?: ReportInput; onDone?: () => void }) {
  return (
    <MenuItem
      onClick={() => {
        copyReport(input ?? {});
        onDone?.();
      }}
    >
      <ListItemIcon>
        <BugReportOutlinedIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText primary="回報問題" secondary="複製一張診斷單，貼給我們就行" />
    </MenuItem>
  );
}

export function ReportListItem({ input }: { input?: ReportInput }) {
  return (
    <ListItemButton onClick={() => copyReport(input ?? {})}>
      <ListItemIcon>
        <BugReportOutlinedIcon />
      </ListItemIcon>
      <ListItemText primary="回報問題" secondary="複製一張診斷單（版本、畫面、裝置），貼給我們" />
    </ListItemButton>
  );
}
