import { get, patch } from '@/shared/lib/http';

/**
 * 🔴 **`enabled` 與 `bound` 是兩件事**：前者是設定值，後者是這次啟動實際綁的介面。
 * 改完還沒重啟時兩者不一致 —— 畫面必須說得出「還沒生效」，不可以宣稱已開啟。
 */
export type NetworkState = {
  enabled: boolean;
  /** 這次啟動實際綁的介面。`127.0.0.1` ＝ 只有本機連得到。 */
  bound: string;
  /** `HOST` 環境變數蓋過設定 ⇒ 這顆開關現在管不到。 */
  forcedByEnv: boolean;
  port: number;
  urls: { kind: 'tailscale' | 'lan'; url: string }[];
};

export const fetchNetwork = (): Promise<NetworkState> => get<NetworkState>('/api/network');

export const setNetwork = (enabled: boolean): Promise<{ needsRestart: boolean }> =>
  patch('/api/network', { enabled });
