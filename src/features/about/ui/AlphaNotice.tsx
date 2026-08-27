import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';

/**
 * 「目前是 Alpha 版本」那段提示的**唯一一份文案**（Peter 2026-08-27）。
 *
 * 🔴 三個地方要講同一件事：**首次啟動第一頁**（他還在決定要不要投入的那一刻）、
 * **關於與更新**（裝好之後想確認時找得到）、以及每一版 **Release 頁**
 * （`RELEASE-NOTES/_download-table.md`，那份是 markdown 不吃這支）。
 * 各寫一份的話遲早有一邊被改軟，而被改軟的那一份不會有人發現。
 *
 * 🔴 **不要寫成「請見諒」**。要說得出**具體會發生什麼**：畫面會在版本之間直接改變、
 * 不保證相容。抽象的免責等於沒有提示（同 `NoLoginWarning` 的判準）。
 *
 * ⚠️ **不寫沒查證過的機制**。例如「升級會不會保留資料」——那要實測升級一次才算數，
 * 現在只說「建議自己另外留一份」，那句無論機制如何都成立。
 */
export function AlphaNotice() {
  return (
    <Alert severity="info" variant="outlined">
      <AlertTitle>目前是 Alpha 版本</AlertTitle>
      功能還在快速增減，畫面與操作方式<b>可能在版本之間直接改變</b>，不保證每一版都相容。
      重要的對話與角色卡建議自己另外留一份。
    </Alert>
  );
}
