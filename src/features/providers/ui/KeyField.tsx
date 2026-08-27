import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { DraftField } from '@/shared/ui/DraftField';
import type { ToastMsg } from '@/shared/ui/toastMsg';
import { failureToast } from '../failureToast';
import { applyMaskedEdit, maskKey } from '../model';
import { type ProviderRow, testAndSaveKey, testStoredKey } from '../registryApi';
import { keyOkAdornment } from './KeyOk';

/**
 * 貼金鑰並測試連線。
 *
 * 🔴 **欄位一開始就顯示伺服器上存著那把的遮罩**（Peter 2026-08-26）——
 * 「現在存的是哪一把」屬於這個欄位本身，不該用一段說明文字轉述。
 *
 * 🔴 **只有測試成功才會存**（`POST /api/secrets/test` 成功時才 `setKey`）。
 * 沒有另一顆「儲存」鈕 —— 存一把沒測過的金鑰只會讓人以為設定好了。
 */
export function KeyField({
  p,
  stored,
  onNotify,
  onPassed,
}: {
  p: ProviderRow;
  stored: string;
  /** 🔴 tips 走全站唯一的堆疊（`pushToast`），這一層只負責產出訊息內容。 */
  onNotify: (m: ToastMsg) => void;
  /**
   * 金鑰測過了 —— 把**這把金鑰拿得到的模型清單**交出去。
   * 🔴 呼叫端會拿它自動挑一個模型再測一次（Peter 2026-08-26：
   * 「測試一成功後，也自動挑個預設模型，也測試」）——
   * 金鑰通得過不代表送得出去（餘額不足就是這樣）。
   */
  onPassed: (models: string[]) => void;
}) {
  const qc = useQueryClient();
  /**
   * `real` ＝ 使用者**這次貼進來的新金鑰**（前端持有的真值）。
   * `dirty` ＝ 他動過欄位沒有。
   *
   * 🔴 **兩者必須分得開**：欄位一開始顯示的遮罩是**伺服器給的**，前端沒有那把的真值。
   * 沒有 `dirty` 的話，「沒動過」與「貼了新的」在 code 裡長得一樣，
   * 而那會讓「測存著的」與「測新的」選錯邊。
   */
  const [real, setReal] = useState('');
  const [dirty, setDirty] = useState(false);

  const test = useMutation({
    // 動過就測新的（成功時後端順便存起來）；沒動過就測伺服器上存著的那把 ——
    // 🔴 後者**金鑰完全不離開伺服器**，比「重貼一次再測」少一次傳輸。
    mutationFn: () => (dirty ? testAndSaveKey(p.id, real) : testStoredKey(p.id)),
    onError: () => onNotify({ severity: 'warning', text: '連不上，沒有存' }),
    onSuccess: (r) => {
      /*
       * 🔴 **這一頁只用 tips，沒有常駐的提示訊息**（Peter 2026-08-26）。
       * 原文不會消失 —— 它在 tips 的複製鈕裡，而錯誤類的 tips 停留 5 秒。
       */
      if (!r.ok) {
        onNotify(failureToast(r, { id: p.id, displayName: p.displayName }, p.consoleUrl));
        return;
      }
      // 措辭與 first-run 的成功訊息一字不差 —— 同一件事在兩個入口不可以講得不一樣。
      onNotify({ severity: 'success', text: `連線成功 —— ${r.models.length} 個模型可用` });
      void qc.invalidateQueries({ queryKey: ['providerRows'] });
      // 換了新金鑰 ⇒ 遮罩也要跟著換，不然畫面上還是舊那把的前四後四。
      void qc.invalidateQueries({ queryKey: ['keyPreview'] });
      /*
       * 🔴 **模型清單在「存下金鑰」的那一刻就過期了**（Peter 2026-08-27 實機踩到）。
       * 沒金鑰時 `/models/:provider` 回的是 400「還沒設定 X 的金鑰。」，而那份
       * `{ok:false}` 會留在 react-query 的 `['models', provider]` 快取裡
       * —— 對話現在打哪一家由清單頁的 `InlineModelPicker` 先拉過一次，
       * 所以連還沒設金鑰的預設那家都已經有一筆壞掉的快取。
       * 不作廢的話：金鑰設好了，下面的模型下拉還停在「拉不到清單」那個狀態。
       */
      void qc.invalidateQueries({ queryKey: ['models', p.id] });
      // 存好了 ⇒ 回到「顯示伺服器那把的遮罩」，不要停在他剛打的那串。
      setDirty(false);
      setReal('');
      // 金鑰過了，接著自動確認「真的送得出去」。
      onPassed(r.models);
    },
  });
  const canTest = dirty ? Boolean(real.trim()) : p.keySet;

  return (
    <Stack spacing={2}>
      <DraftField
        /**
         * 🔴 金鑰刻意不存草稿：存明碼到 `localStorage` 的風險大於重貼一次的成本。
         * 而且這個框顯示的是遮罩字串，存進去也只會存到一串圓點。
         */
        noDraft="API 金鑰不落地：存明碼到 localStorage 的風險大於重貼一次的成本"
        /* 🔴 尺寸刻意不設 `size="small"` —— first-run 的金鑰欄是預設大小，兩邊要一樣。 */
        fullWidth
        label="API 金鑰"
        placeholder={`貼上金鑰（${p.keyHint}）`}
        autoComplete="off"
        spellCheck={false}
        /*
         * 🔴 打勾的條件是**伺服器上有一把測過的金鑰、而且使用者沒有正在改它**。
         * `dirty` 的時候不打勾 —— 他手上那串還沒測過，打勾會是謊話。
         */
        slotProps={{
          htmlInput: { autoCapitalize: 'none', autoCorrect: 'off' },
          input: keyOkAdornment(!dirty && p.keySet),
        }}
        value={dirty ? maskKey(real) : stored}
        onChange={(next) => {
          if (!dirty) {
            setDirty(true);
            /*
             * 🔴 第一次動的時候，欄位裡是**伺服器的遮罩**，不是我們的值 ——
             * 不能拿它當「已有前綴」去接。判準只有兩種，刻意不猜：
             *   · 整串貼上（不含遮罩字元）⇒ 那就是新金鑰
             *   · 其他任何編輯 ⇒ **清空重打**
             * 猜錯會產生一把「看起來對、其實是錯的」金鑰，比重貼一次糟得多。
             */
            setReal(next.includes('•') ? '' : next);
            return;
          }
          setReal(applyMaskedEdit(real, maskKey(real), next));
        }}
      />
      {/* 🔴 整條寬的 outlined 鈕 —— 照抄 first-run，不是靠左的短鈕。 */}
      <Button
        variant="outlined"
        loading={test.isPending}
        disabled={!canTest}
        onClick={() => test.mutate()}
      >
        {dirty ? '測試並儲存' : '測試連線'}
      </Button>
    </Stack>
  );
}
