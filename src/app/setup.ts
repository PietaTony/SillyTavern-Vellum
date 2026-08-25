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
