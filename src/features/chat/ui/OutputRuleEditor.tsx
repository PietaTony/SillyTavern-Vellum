import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { clearDraft, readDraft } from '@/shared/lib/draftStore';
import {
  blankOutputRule,
  createOutputRule,
  type OutputRuleInput,
  outputRuleDraftKey,
  type StoredOutputRule,
  updateOutputRule,
} from '../outputRulesApi';
import { OutputRuleFields } from './OutputRuleFields';

const DRAFT_FIELDS = ['name', 'find', 'replace', 'trim'] as const;

/**
 * 新增／編輯一條輸出規則（D1）。**只畫 `applyRules` 真的會讀的欄位**（總則五）：
 * `name`／`find`／`replace`／`target`／`minDepth`／`maxDepth`／`trim`／`enabled`
 * （形狀對齊 `server/lib/outputRules.ts` 的 `OutputRule`）。表單本體在 `OutputRuleFields.tsx`
 * （`gate:file-size`：`Dialog` 外殼 ＋ 存檔邏輯 ＋ 整份表單放不進同一支檔案）。
 *
 * 🔴 **正則合不合法在存檔時才驗**（後端 `regexFrom()`），這裡不重複實作一套前端驗證邏輯
 * 再跟後端對不齊——單一正本：後端說壞，這裡就顯示後端回的那句話，不猜是哪裡壞的。
 *
 * 🔴 **草稿要存**（`gate:draft` 也會擋）：規則的 `find`／`replace` 常常是打到一半的正則，
 * 中途被瀏覽器收掉分頁的話要救得回來。**只有「取消」在這裡清草稿**——存成功也清
 * （這裡跟 `MessageEditor` 不同：那邊存成功清在呼叫端，這裡因為 mutation 就在本檔，
 * 直接在 `onSuccess` 做，不必再往上傳一層）。
 *
 * ⚠️ **一般的 `<Dialog>`，不是 `FullScreenLayer`**——這是疊在清單層之上的「單一操作」，
 * 不是清單本身的下一級導覽（`FullScreenLayer` 檔頭要求多級導覽用 `onBack`，
 * 這裡刻意不套那個規則：兩顆按鈕語意分開——「取消」關掉自己、「儲存」才觸發存檔，
 * 跟清單層的 ✕ 沒有衝突，不會有關錯層的問題）。
 */
export function OutputRuleEditor({
  open,
  rule,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** `null` ＝ 新增。 */
  rule: StoredOutputRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const scope = rule?.id ?? 'new';
  // 還原在 initializer 同步做完，不在 effect 裡（理由見 `useDraftWriter` 檔頭）。
  const [draft, setDraft] = useState<OutputRuleInput>(() => {
    const base = rule ?? blankOutputRule();
    const trimDraft = readDraft<string>(outputRuleDraftKey(scope, 'trim'));
    return {
      ...base,
      name: readDraft<string>(outputRuleDraftKey(scope, 'name')) ?? base.name,
      find: readDraft<string>(outputRuleDraftKey(scope, 'find')) ?? base.find,
      replace: readDraft<string>(outputRuleDraftKey(scope, 'replace')) ?? base.replace,
      trim:
        trimDraft === null
          ? base.trim
          : trimDraft
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
    };
  });

  const clearDrafts = () => {
    for (const f of DRAFT_FIELDS) clearDraft(outputRuleDraftKey(scope, f));
  };

  const save = useMutation({
    mutationFn: () => (rule ? updateOutputRule(rule.id, draft) : createOutputRule(draft)),
    onSuccess: () => {
      clearDrafts();
      onSaved();
    },
  });

  const cancel = () => {
    clearDrafts();
    onClose();
  };

  const set =
    <K extends keyof OutputRuleInput>(k: K) =>
    (v: OutputRuleInput[K]) =>
      setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Dialog open={open} onClose={cancel} maxWidth="xs" fullWidth>
      <DialogTitle>{rule ? '編輯規則' : '新增規則'}</DialogTitle>
      <DialogContent>
        {save.isError ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            存不起來：{save.error instanceof Error ? save.error.message : ''}
          </Alert>
        ) : null}
        <OutputRuleFields draft={draft} set={set} scope={scope} />
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={cancel} disabled={save.isPending}>
          取消
        </Button>
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || !draft.name || !draft.find}
        >
          儲存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
