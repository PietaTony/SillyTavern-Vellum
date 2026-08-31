import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { pushToast } from '@/shared/ui/toastStore';
import { type DeletePersonaResult, deletePersona } from '../api';

/** 把 `refs` 翻成人看得懂的理由——後端只給數字，畫面要講出「為什麼」。 */
function reasons(refs: { chats: number; friends: number; isDefault: boolean }): string[] {
  const out: string[] = [];
  if (refs.isDefault) out.push('它是目前的全域預設');
  if (refs.friends > 0) out.push(`${refs.friends} 個好友指定用它`);
  if (refs.chats > 0) out.push(`${refs.chats} 段對話正在用它`);
  return out;
}

/**
 * 刪除 persona 的確認 ＋ 結果說明。
 *
 * 🔴 **`removed: false` 不能只是一則會消失的 tips**（後端規格 §4.3「甲」：
 * 被引用中的只封存不刪，`server/routes/personas.ts` 檔頭）。按了刪除卻只是封存，
 * 使用者要有機會看懂「為什麼」，所以這裡用**不會自動關掉的對話框**接住結果，
 * 不是 `pushToast`——tips 幾秒就消失，這句解釋不能被使用者錯過。
 *
 * ⚠️ **封存之後這個 persona 會從清單消失**（`GET /api/personas` 預設濾掉 `archived`），
 * 但既有引用（對話、好友、全域預設）繼續照常運作——後端沒有動內容，只加了一個旗標。
 *
 * ⚠️ **`removed: true`（真的刪除）這個分支，目前唯一的呼叫端邏輯上走不到**：
 * `/profile` 的 `current` 恆等於 `defaultPersonaId` 對應的那個 persona，
 * 而後端 `referencedBy()` 判「還在用」的 `isDefault` 正是同一個 id ⇒ 從 `/profile`
 * 刪除**必然**先撞上 `isDefault: true`，落在封存分支。不是 bug——這支元件是
 * 給「刪除」這個動作本身用的，不是只給 `/profile` 用；`removed: true` 是為將來
 * 的 persona 清單管理頁（可以刪一個不是目前預設的 persona）預留的路徑。
 */
export function DeletePersonaDialog({
  open,
  personaId,
  personaName,
  onClose,
  onResult,
}: {
  open: boolean;
  personaId: string;
  /** 只用來組文案——刪完之後 `personaId` 對應的資料可能已經從清單濾掉了。 */
  personaName: string;
  onClose: () => void;
  /**
   * 🔴 **成功一拿到結果就呼叫**（不是等使用者按「知道了」）——呼叫端要立刻讓
   * `personas` 這份查詢重新抓，`removed` 或 `archived` 都一樣：兩種結果那個
   * persona 都會從清單消失，晚做只是讓畫面暫時跟事實不一致。
   */
  onResult: (r: DeletePersonaResult) => void;
}) {
  const m = useMutation({
    mutationFn: () => deletePersona(personaId),
    // 🔴 不能直接 `onSuccess: onResult`——react-query 用 `(data, variables, context)`
    // 三個參數呼叫 onSuccess，呼叫端的型別只想要 `data` 這一個。
    onSuccess: (r) => onResult(r),
  });
  /*
   * 🔴 每次重新打開都是新的一輪確認——上一輪按過的結果不該殘留。
   * `m.reset` 是每次 render 的新函式，放進 deps 會變成每個 render 都重置，
   * 只想在 `open` 真的翻轉時重置。
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 見上
  useEffect(() => {
    if (open) m.reset();
  }, [open]);

  const result = m.data;

  if (result) {
    const list = reasons(result.refs);
    return (
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>{result.removed ? '已刪除' : '改成封存了'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {result.removed ? (
              `「${personaName}」已經刪除。`
            ) : (
              <>
                「{personaName}」沒有真的刪掉，改成<b>封存</b>——因為
                {list.length ? list.join('、') : '目前仍被引用'}。
                <br />
                封存後不會再出現在清單裡，但既有的對話、好友設定不受影響，照常運作。
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={onClose}>
            知道了
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>刪除「{personaName}」？</DialogTitle>
      <DialogContent>
        <DialogContentText>
          如果它還被對話、好友或全域預設引用，不會真的刪掉，會改成封存。
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" disabled={m.isPending} onClick={onClose} autoFocus>
          取消
        </Button>
        <Button
          color="error"
          disabled={m.isPending}
          onClick={() => {
            m.mutate(undefined, {
              onError: (e: Error) =>
                pushToast({ severity: 'warning', text: `刪除失敗：${e.message}` }),
            });
          }}
        >
          刪除
        </Button>
      </DialogActions>
    </Dialog>
  );
}
