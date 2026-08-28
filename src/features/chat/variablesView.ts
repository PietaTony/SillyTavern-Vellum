/**
 * D2：把 `chat.variables` 攤成畫面上一行一行的（唯讀）。純函式（A4）。
 *
 * 🔴 **這裡只呈現「值」，不呈現「卡片宣告的 schema」。**
 * 後端目前沒有任何端點會回傳卡片宣告的變數清單（型別、初始值、約束）——
 * `deriveConfig`／`schemaOf` 只在 `server/lib`／`server/services` 內部被呼叫，
 * 沒有一支 route 把它端出來。要補的話要嘛擴充 `cardVariables.ts`（H6 的檔），
 * 要嘛開一支新路由並在 `server/app.ts` 掛上去（X3，登記新路由本身就要 ticket）——
 * 兩條都不是這次能單層動手的範圍。見這次任務回報。
 *
 * 🔴 **值一律當成不透明資料**（`server/lib/character.ts` 的 `z.unknown()` 那條理由一樣）：
 * 不硬猜形狀，只做「攤平＋轉成字串」。MVU 的慣例是把數值包在 `stat_data` 這個鍵底下
 * （`server/services/applyVarUpdate.ts` 的 `STAT_KEY`），所以巢狀物件會展開成
 * `stat_data.安全感` 這種一行，而不是整包印成一坨 JSON。
 */

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
