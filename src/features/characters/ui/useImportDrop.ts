import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type DragEvent, useState } from 'react';
import { pushToast } from '@/shared/ui/toastStore';
import { importCardFileWithProgress, nameOf } from '../api';
import { validateCardFile } from '../lib/validateCardFile';

export type ImportDropStatus = 'idle' | 'dragging' | 'selected' | 'uploading' | 'error';

export type DragHandlers = {
  onDragEnter: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
};

/**
 * `import/drop` 這張畫面的狀態機。抽成 hook 是因為它同時要管
 * 拖曳事件、client 端驗證、`useMutation`、成功後導頁——四件事擠在
 * route 檔裡會直接破 150 行上限。
 */
export function useImportDrop() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isOver, setIsOver] = useState(false);
  /**
   * 0–1 的上傳進度；`null` ＝ 拿不到（`lengthComputable` 是 false）——
   * 這時畫面要退回不定量 spinner，不是卡在 0%。
   */
  const [progress, setProgress] = useState<number | null>(null);

  const m = useMutation({
    mutationFn: (f: File) =>
      f.arrayBuffer().then((bytes) => importCardFileWithProgress(bytes, setProgress)),
    onMutate: () => setProgress(null),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['characters'] });
      pushToast({ severity: 'success', text: `已加入「${nameOf(c)}」` });
      /*
       * 🔴 **這裡之後接 scan／progress**（`import/scan`、`import/progress`，
       * M2b-import 的後續兩張畫面，`design/screens.json` 的 Import-And-Archive--2／--3）。
       * 現在先直接導回好友清單：後端 `intoCharacter` 已經把角色連同世界書一次寫進 DB，
       * 這一版沒有中間的「掃描」步驟要顯示。
       */
      void nav({ to: '/friends' });
    },
  });

  const pick = (f: File): void => {
    setFile(f);
    setClientError(validateCardFile(f));
    m.reset();
  };

  const status: ImportDropStatus = m.isPending
    ? 'uploading'
    : clientError || m.isError
      ? 'error'
      : file
        ? 'selected'
        : isOver
          ? 'dragging'
          : 'idle';

  const errorMessage =
    clientError ?? (m.error instanceof Error ? m.error.message : m.isError ? '匯入失敗' : null);

  const reset = (): void => {
    setFile(null);
    setClientError(null);
    m.reset();
  };

  const dragProps: DragHandlers = {
    onDragEnter: (e) => {
      e.preventDefault();
      setIsOver(true);
    },
    onDragOver: (e) => e.preventDefault(),
    onDragLeave: (e) => {
      e.preventDefault();
      setIsOver(false);
    },
    onDrop: (e) => {
      e.preventDefault();
      setIsOver(false);
      const f = e.dataTransfer.files[0];
      if (f) pick(f);
    },
  };

  return {
    status,
    file,
    errorMessage,
    /** `null` 時代表不定量：呼叫端要顯示 spinner，不要顯示卡在 0% 的進度條。 */
    uploadProgress: progress,
    dragProps,
    onFileInputChange: pick,
    onCancel: reset,
    onRetry: reset,
    onSubmit: () => {
      if (file && !clientError) m.mutate(file);
    },
  };
}
