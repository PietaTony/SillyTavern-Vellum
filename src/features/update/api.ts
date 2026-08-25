import { get } from '@/shared/lib/http';

export type UpdateInfo = {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  url: string;
  /** 🔴 人寫的重點，不是 commit 訊息（設計正本 U-D3）。 */
  notes: string | null;
  /** 🔴 破壞性變更必須單獨標出來，不能埋在清單裡（設計正本 U-D3）。 */
  breaking: boolean;
  /** 🔴 查不到 ≠ 沒有新版。離線、被 GitHub 限流都會落在這裡。 */
  error?: string;
};

export const fetchUpdate = (): Promise<UpdateInfo> => get<UpdateInfo>('/api/update');
