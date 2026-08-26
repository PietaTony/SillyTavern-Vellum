/**
 * 「去哪裡拿金鑰」的逐步文案。**這是 onboarding 的文案，不是 registry。**
 *
 * 🔴 供應商本身（id／狀態／預設模型／控制台網址）的**唯一真相在後端**
 * `server/providers/registry.ts` —— 這裡只放那份沒有、也不該有的東西：
 * 給人看的操作步驟。
 *
 * 🔴 **2026-08-26：22 家可用的供應商全部補齊**（Peter：「每一個都要做」）。
 * 在此之前只有 google／anthropic 有，其餘 20 家退回「控制台連結 ＋ 金鑰格式」兩行版
 * —— 而那個連結當時還指向 API endpoint（見 `server/providers/consoles.ts` 檔頭）。
 *
 * ⚠️ **`planned` 的四家（vertexai／workers_ai／azure_openai／custom）刻意沒有步驟**：
 * 那幾家的畫面走 `PlannedNote`，講的是「我們還缺什麼」，不是「你該去哪裡拿金鑰」。
 * 教人辦一把用不了的金鑰，就是我們剛修掉的那條死路。
 */
import { FIRST_PARTY_STEPS } from './steps/firstParty';
import { PLATFORM_STEPS } from './steps/platforms';

export const STEPS_BY_PROVIDER: Record<string, string[]> = {
  ...FIRST_PARTY_STEPS,
  ...PLATFORM_STEPS,
};
