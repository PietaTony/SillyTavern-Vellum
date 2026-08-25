import { get } from '@/shared/lib/http';

export type UpdateInfo = {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  url: string;
  /** 🔴 查不到 ≠ 沒有新版。離線、被 GitHub 限流都會落在這裡。 */
  error?: string;
};

export const fetchUpdate = (): Promise<UpdateInfo> => get<UpdateInfo>('/api/update');
