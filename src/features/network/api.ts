import { get, patch } from '@/shared/lib/http';

/**
 * 🔴 **`enabled` 與 `bound` 是兩件事**：前者是設定值，後者是這次啟動實際綁的介面。
 * 改完還沒重啟時兩者不一致 —— 畫面必須說得出「還沒生效」，不可以宣稱已開啟。
 */
export type NetworkState = {
  enabled: boolean;
  bound: string;
  forcedByEnv: boolean;
  port: number;
  urls: { kind: 'tailscale' | 'lan'; url: string }[];
  /** 是否已設定存取密碼。 */
  hasPassword: boolean;
};

export const fetchNetwork = (): Promise<NetworkState> => get<NetworkState>('/api/network');

export const setNetwork = (enabled: boolean): Promise<{ needsRestart: boolean }> =>
  patch('/api/network', { enabled });
