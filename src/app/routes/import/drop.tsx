import { createFileRoute } from '@tanstack/react-router';
import { useBack } from '@/app/screens/useBack';
import {
  ImportDropZone,
  ImportErrorPanel,
  ImportSelectedPanel,
  useImportDrop,
} from '@/features/characters';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/import/drop')({ component: ImportDrop });

/**
 * M2b-import 第一張畫面：把角色卡 PNG 丟進來。
 * `design/screens.json` 的 `Settings-Theme-Import--8`。
 *
 * 🔴 **只做這一張**。`import/scan`（掃描結果）與 `import/progress`（匯入中）
 * 是同一個里程碑的後續兩張畫面，刻意不做——理由與接點寫在 `useImportDrop.ts`
 * 的 `onSuccess` 裡（現在直接導回好友清單）。
 */
function ImportDrop() {
  const onBack = useBack();
  const d = useImportDrop();

  return (
    <Screen title="匯入角色卡" onBack={onBack}>
      {d.status === 'error' && d.errorMessage ? (
        <ImportErrorPanel message={d.errorMessage} onRetry={d.onRetry} />
      ) : d.file ? (
        <ImportSelectedPanel
          file={d.file}
          uploading={d.status === 'uploading'}
          uploadProgress={d.uploadProgress}
          onCancel={d.onCancel}
          onSubmit={d.onSubmit}
        />
      ) : (
        <ImportDropZone
          dragging={d.status === 'dragging'}
          dragProps={d.dragProps}
          onFile={d.onFileInputChange}
        />
      )}
    </Screen>
  );
}
