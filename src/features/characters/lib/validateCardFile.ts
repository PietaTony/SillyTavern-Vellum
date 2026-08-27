/**
 * 送出前的第一層檢查，純函式、不碰網路。
 *
 * 🔴 **不是最終判準**：「是不是角色卡」只有後端 `intoCharacter`
 * （解析 PNG 的 tEXt chunk）才知道——這裡只擋看檔案本身就能判斷的兩種：
 * 不是 PNG、超過後端上限。真正會擋卡的錯誤（例如 tEXt 裡沒有角色資料）
 * 一定要等 `POST /api/characters/import` 回來才看得到，不能在這裡假裝擋得住。
 */

/**
 * 與 `server/http/bodyLimits.ts` 的 `/api/characters/import` 規則同一個數字。
 * 🔴 **這裡不是權威**——真正生效的上限在後端；這份只是為了不用等一趟網路
 * 往返就能給出「太大了」的回饋。兩邊要一起改。
 */
export const MAX_CARD_BYTES = 64 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** 通過回傳 `null`，不通過回傳**可以直接顯示給使用者看的**引導文案。 */
export function validateCardFile(file: File): string | null {
  const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
  if (!isPng) return '這不是 PNG 檔。角色卡（TavernCard）都是 PNG 格式，選一張 .png 試試';
  if (file.size > MAX_CARD_BYTES) {
    return `檔案太大了（${formatBytes(file.size)}）。角色卡上限是 ${formatBytes(MAX_CARD_BYTES)}，多半是選錯了檔案`;
  }
  return null;
}
