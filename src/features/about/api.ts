import { get } from '@/shared/lib/http';

/**
 * 版本 ＋ 授權與原始碼位置。🔴 **這一份資訊有法律義務**（AGPL §13），
 * 不是「關於」頁的裝飾 —— 見 `ui/SourceCard.tsx` 的檔頭。
 */
export type AboutInfo = {
  name: string;
  version: string;
  license: string;
  /** 🔴 **這個站台的營運者宣告的**原始碼位置，不一定是我們的 repo。 */
  source: string;
  upstream: string;
};

export const fetchAbout = (): Promise<AboutInfo> => get<AboutInfo>('/api/version');
