import { fetchKeyStatus } from '@/features/providers';
import { queryClient } from './queryClient';

/** 金鑰狀態的唯一 query key —— 守衛與畫面共用同一份快取，不會各查各的。 */
export const KEY_STATUS_QUERY = { queryKey: ['secrets'], queryFn: fetchKeyStatus } as const;

/**
 * 「首次設定完成了沒」的唯一判準：**至少有一家供應商的金鑰已設定**。
 *
 * 🔴 金鑰是在 `POST /api/secrets/test` **測試通過的當下**被存下來的
 * （見 `server/routes/secrets.ts`）—— 不是另外按存檔。
 * ⇒ 「測試通過」與「設定完成」是同一個瞬間，守衛要照這個事實寫。
 */
export async function isSetUp(): Promise<boolean> {
  const status = await queryClient.ensureQueryData(KEY_STATUS_QUERY);
  return Object.values(status).some(Boolean);
}

/**
 * 這一個網址現在該不該被踢回首次啟動流程。
 *
 * 🔴 **首次流程是必經的**（Peter 2026-08-27：「理論上 first run 必跑，
 * 沒跑過不能路由亂跑」）。在此之前只有 `/` 這一個入口會分流 ——
 * 其餘每一支 route（`/chat-list`、`/worlds`、`/settings`、`/chat/$id`…）
 * 直接打網址就進得去，而那時候**一把金鑰都還沒有**：
 * 聊天清單是空的、送訊息必然失敗、世界書沒有書 ——
 * 使用者看到的是一個壞掉的產品，而不是「你還沒設定」。
 *
 * 🔴 **`/first-run/*` 自己一定要放行**，否則守衛會把它導向自己 ⇒ 無限重導。
 * 這是這條規則唯一會出人命的地方，所以判準抽出來單獨測。
 *
 * ⚠️ 反方向的守衛在 `routes/first-run/route.tsx`（設定完成就再也進不來），
 * 兩條合起來才是「必經且只經一次」。
 */
export const needsFirstRun = (pathname: string, setUp: boolean): boolean =>
  !setUp && !pathname.startsWith('/first-run');
