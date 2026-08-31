import Button from '@mui/material/Button';
import { useState } from 'react';
import type { DeletePersonaResult, Persona } from '../api';
import { DeletePersonaDialog } from './DeletePersonaDialog';

/**
 * `/profile` 的「刪除這個 persona」按鈕 ＋ 確認流程，抽成獨立元件——
 * 純粹是把三個分支（要不要畫鈕、要不要畫對話框、對話框指向哪個 id/name 的快照）
 * 從 `MePage` 搬出去，不然那支 route 元件的認知複雜度會超過 `gate:lint` 的門檻。
 *
 * 🔴 **`target` 是自己的快照 state，不是直接讀 `persona` prop**——理由跟
 * `DeletePersonaDialog` 檔頭一樣：結果一出來（不管刪掉還是封存）都會讓上層的
 * `persona` 變成 `null`，如果對話框綁的是 `persona` 本身就會跟著被拆掉。
 */
export function DeletePersonaSection({
  persona,
  onResult,
}: {
  persona: Persona | null;
  onResult: (r: DeletePersonaResult) => void;
}) {
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);

  return (
    <>
      {persona ? (
        <Button
          color="error"
          size="small"
          sx={{ mt: 1 }}
          onClick={() => setTarget({ id: persona.id, name: persona.name || '（沒有名字）' })}
        >
          刪除這個 persona
        </Button>
      ) : null}
      {target ? (
        <DeletePersonaDialog
          open
          personaId={target.id}
          personaName={target.name}
          onClose={() => setTarget(null)}
          onResult={onResult}
        />
      ) : null}
    </>
  );
}
