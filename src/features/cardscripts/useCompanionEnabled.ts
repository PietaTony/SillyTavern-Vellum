import { useQuery } from '@tanstack/react-query';
import { get } from '@/shared/lib/http';

/**
 * E1 桌寵開關（跨層票，Peter 2026-08-28 簽，鎖期間借住 chat-core）。
 *
 * 🔴 **關掉時 `useCardScripts` 讓 `background` 直接是 `null`**——跟「沒同意」走
 * 同一條「這個 frame 根本不存在」的路（見 `CardBackground.tsx`：`!cards.background`
 * 就不畫），不是 CSS 藏起來、背後還在跑。
 *
 * ⚠️ 這裡不 import `features/chat` 的 `fetchCompanionEnabled`——那樣會讓
 * `cardscripts` 長出對 `chat` 的相依。兩邊各自直接打同一支端點，跟
 * `backgrounds`／`providers` 那幾層一樣鬆耦合。**沒讀到之前預設開**——
 * 這樣讀取端點失敗時桌寵行為與「這個開關還不存在」的年代一致。
 */
export function useCompanionEnabled(): boolean {
  const q = useQuery({
    queryKey: ['companion-enabled'],
    queryFn: () => get<{ enabled: boolean }>('/api/settings/companion'),
    staleTime: 30_000,
  });
  return q.data?.enabled ?? true;
}
