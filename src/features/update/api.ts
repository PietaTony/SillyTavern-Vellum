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
  /** 上次真正打了 GitHub 的時間（epoch ms）。設定頁「上次檢查」顯示這個，不是「現在」。 */
  checkedAt: number;
  /**
   * 🔴 桌面版（安裝版）有 Electron 的原生更新器接手 ⇒ **banner 要讓開**。
   * portable exe 與 zip 版是 `false`，那些人還是要靠 banner。
   */
  nativeUpdater: boolean;
};

/**
 * `force` 繞過後端六小時快取 —— 設定頁的「檢查更新」按鈕要用得到，
 * 平常 `UpdateBanner` 開畫面時不用，讓它繼續吃快取。
 */
export const fetchUpdate = (opts?: { force?: boolean }): Promise<UpdateInfo> =>
  get<UpdateInfo>(opts?.force ? '/api/update?force=1' : '/api/update');
