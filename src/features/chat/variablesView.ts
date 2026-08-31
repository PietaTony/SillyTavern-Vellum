/**
 * D2：把 `chat.variables` 攤成畫面上一行一行的（唯讀）。純函式（A4）。
 *
 * 🔴 **這裡只呈現「值」。「卡片宣告的 schema」那一塊在下面的 `schemaRows`。**
 * 原本這裡沒有 schema 是因為後端沒有端點（`deriveConfig`／`schemaOf` 只在
 * `server/lib`／`server/services` 內部被呼叫）—— H6 後來補了
 * `GET /api/card-variables/:characterId/schema`（`server/routes/cardVariables.ts:56-67`），
 * `schemaRows` 就是接住那支端點的攤平函式。
 *
 * 🔴 **值一律當成不透明資料**（`server/lib/character.ts` 的 `z.unknown()` 那條理由一樣）：
 * 不硬猜形狀，只做「攤平＋轉成字串」。MVU 的慣例是把數值包在 `stat_data` 這個鍵底下
 * （`server/services/applyVarUpdate.ts` 的 `STAT_KEY`），所以巢狀物件會展開成
 * `stat_data.安全感` 這種一行，而不是整包印成一坨 JSON。
 */
import type { VarSchema } from '@/shared/types/varSchema';

export type VariableRow = { label: string; value: string };

function formatValue(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return '（無）';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * 攤平規則：頂層的鍵如果是「非陣列的物件」（例如 `stat_data`），
 * 展開成 `scope.key` 一行一行；其餘（純量／陣列）直接用頂層的鍵當作那一行。
 */
export function variableRows(variables: Record<string, unknown> | undefined): VariableRow[] {
  const rows: VariableRow[] = [];
  for (const [scope, value] of Object.entries(variables ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        rows.push({ label: `${scope}.${key}`, value: formatValue(v) });
      }
    } else {
      rows.push({ label: scope, value: formatValue(value) });
    }
  }
  return rows;
}

/**
 * D2 的另一半：卡片**宣告**了哪些變數 —— 攤平 `VarSchema.variables`，一列一個。
 * 純函式（A4）。輸入是 `fetchCardVariableSchema()` 的回傳，`null`／`undefined` 都是
 * 「沒有宣告」（不是錯誤，見 `api.ts` 的 `fetchCardVariableSchema` 檔頭）⇒ 回空陣列，
 * 由畫面那層決定空陣列要畫成什麼字。
 *
 * 🔴 **不含 `derived`／`constraints`。**
 * - `derived`：目前引擎永遠回空陣列（`deriveConfig.ts:53`），沒有真卡跑出過非空值，
 *   畫出一個「衍生變數」區塊只會是一直空著的裝飾。
 * - `constraints`：驗證過是引擎寫死套在所有數字變數上的規則（±3／0~100 clamp／
 *   `樓層 < 2` 豁免，`applyVarUpdate.ts:50-55`），跟卡片宣告無關 —— 畫出來會讓使用者
 *   誤以為那是這張卡自訂的。型別在 `VarSchema.constraints` 是完整的，這裡只是不用它。
 *
 * 🔴 **不依 `type` 分支畫不同東西。** `VarType` 有 number／string／enum／bool 四種，
 * 但 `parseInitVars`（`deriveConfig.ts:20-36`）只推得出 number／string，enum／bool
 * 目前沒有任何真卡會走到 —— 寫一個「enum 要畫下拉、bool 要畫開關」的分支只是沒人
 * 測過的死路徑。`initial` 一律用既有的 `formatValue` 轉成字串，跟型別呈現法一起收斂。
 */
export type SchemaRow = { label: string; type: string; initial: string; readonly: boolean };

export function schemaRows(schema: VarSchema | null | undefined): SchemaRow[] {
  if (!schema) return [];
  return schema.variables.map((v) => ({
    label: v.name,
    type: v.type,
    initial: formatValue(v.initial),
    readonly: v.readonly === true,
  }));
}
