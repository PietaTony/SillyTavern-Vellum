import { type UseQueryResult, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { pushToast } from '@/shared/ui/toastStore';
import { createGlobalWorld, deleteGlobalWorld, renameGlobalWorld } from './api';
import { importGlobalWorld } from './importExport';

/**
 * `/worlds` 頁面的四顆變更操作（建／刪／改名／匯入），抽出來只是為了讓
 * `worlds/index.tsx` 不頂到 `gate:file-size` 的 150 行——邏輯沒有變，
 * 純粹搬家（B9 加了 `rename` 這一顆，母檔案才超線）。
 *
 * 🔴 B9：`renameGlobalWorld()`（`api.ts`）與後端 `PATCH /api/global-worlds/:id`
 * 早就通了，但沒有任何畫面呼叫過——`rename` 就是補上的那道門。
 * 與 `del` 共用 `busyId`：改名跟刪除都是「動這一本」的操作，不該同時對同一本跑兩個。
 */
export function useGlobalWorldMutations(
  refetch: () => Promise<UseQueryResult['data']> | Promise<unknown>,
  afterCreate: (w: { id: string }, text: string) => void | Promise<void>,
) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (preset?: string) => createGlobalWorld(preset),
    onSettled: () => setPendingKey(null),
    onSuccess: (w) => afterCreate(w, `已加入「${w.name}」，條目都先關著`),
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteGlobalWorld(id),
    onMutate: setBusyId,
    onSettled: () => setBusyId(null),
    onSuccess: () => void refetch(),
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameGlobalWorld(id, name),
    onMutate: ({ id }) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: () => void refetch(),
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });
  // 🔴 與 `add` 不同：條目照檔案原樣，toast 不能講「先關著」。
  const importMut = useMutation({
    mutationFn: (text: string) => importGlobalWorld(text),
    onSuccess: (w) =>
      afterCreate(w, `已匯入「${w.name}」（開著 ${w.enabledCount}/${w.entryCount}）`),
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });

  return { busyId, pendingKey, setPendingKey, add, del, rename, importMut };
}
