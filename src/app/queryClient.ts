import { QueryClient } from '@tanstack/react-query';

// 伺服器狀態一律住這裡，不進 Zustand。
// ST 最大的一類 bug 是「同一份資料記憶體一份、伺服器一份，兩邊不同步」。
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
