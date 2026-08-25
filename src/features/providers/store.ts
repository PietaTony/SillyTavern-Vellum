import { create } from 'zustand';
import type { ProviderId } from './model';

/** 客戶端狀態：使用者在首次啟動時選了誰。伺服器狀態（金鑰是否已設定）走 TanStack Query。 */
type State = {
  selected: ProviderId | null;
  select: (id: ProviderId) => void;
};

export const useProviderChoice = create<State>((set) => ({
  selected: null,
  select: (id) => set({ selected: id }),
}));
