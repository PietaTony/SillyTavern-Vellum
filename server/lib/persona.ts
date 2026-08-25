/**
 * Persona ＝ **我方**。角色卡是**對方**。
 *
 * 🔴 兩者欄位重疊但語意相反，**不共用一張表** —— 共用會讓「誰是誰」在組 prompt 時
 * 失去型別保護，而那正是最不能出錯的地方（規格 §4.2）。
 *
 * 🔴 `name` 驅動 `{{user}}`；`description` 進 prompt。**兩條路，不要混為一談**
 * （ST `personas.js:902` 與 `openai.js:1424` 是不同機制）。
 */
import { z } from 'zod';

/** description 進 prompt 的位置。值對齊 ST（`personas.js:90`）。 */
export const PERSONA_POSITION = ['in_prompt', 'top_an', 'bottom_an', 'at_depth', 'none'] as const;
export type PersonaPosition = (typeof PERSONA_POSITION)[number];

export const PersonaSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  avatar: z.string().default(''),
  description: z.string().default(''),
  position: z.enum(PERSONA_POSITION).default('in_prompt'),
  /** 只在 `at_depth` 生效。 */
  depth: z.number().default(4),
  role: z.number().default(0),
  /** 這個 persona 專屬的世界書（接世界書的 persona 層）。 */
  lorebookId: z.string().optional(),
  /** 顯示用副標，**不進 prompt**。 */
  title: z.string().default(''),
  /**
   * 🔴 **封存不是刪除**（規格 §4.3 甲）。被引用中的 persona 不可刪，只能封存：
   * 清單上不顯示，但**引用仍然有效**。
   * 直接刪掉會讓歷史訊息裡的名字與 prompt 分裂 —— LLM 會把舊名字當成場景中的第三個人。
   */
  archived: z.boolean().default(false),
  createdAt: z.string(),
});
export type Persona = z.infer<typeof PersonaSchema>;

/** 沒有任何 persona 時的回退。**與現況一致**（`{{user}}` ＝「你」），不會弄壞既有對話。 */
export const FALLBACK_USER_NAME = '你';

export const displayOf = (p: Persona | null): string => p?.name?.trim() || FALLBACK_USER_NAME;
