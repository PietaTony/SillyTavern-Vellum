/**
 * 好友的顯示名（Peter 裁定 D-h）。
 *
 * 🔴 **顯示名與卡片的 `data.name` 分開存，改名永不寫回角色卡。**
 * 寫回就是損毀別人的卡（驗收 A1）——那張卡可能還要匯出去給別人。
 *
 * 🔴 **顯示名是「好友實例」的屬性，不是卡片的屬性。** 同一張卡加入三次是三個好友，
 * 各自可以有自己的名字。升級（D-g）換的是內容不是身分，**不得覆蓋顯示名**——
 * 名字被改掉，使用者會找不到自己的好友。
 */

/**
 * 加入時自動避開重名：第一個保持原名，第二個起加 `(n)`。
 *
 * 🔴 **取「當前未被使用的最小 n」，而且產生後要再確認一次唯一**——
 * 直接用「已有幾個」算下一個編號會撞上：使用者可能早就手動把某個好友命名成 `某某(1)`。
 */
export function uniqueDisplayName(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 1; n < 10_000; n += 1) {
    const candidate = `${base}(${n})`;
    if (!used.has(candidate)) return candidate;
  }
  // 極端情況（一萬個同名）：退回用時間戳，仍然保證唯一。
  return `${base}(${Date.now()})`;
}

/** 顯示用的名字：沒設過就回退到卡片原名（既有資料不需要 migration）。 */
export const displayNameOf = (c: { name: string; displayName?: string | undefined }): string =>
  c.displayName && c.displayName.trim() !== '' ? c.displayName : c.name;

/** 手動改名時的提示。🔴 **只提示不改寫**——強行改掉使用者剛打的字很粗暴，內部靠 id 分辨。 */
export const nameClash = (wanted: string, taken: Iterable<string>): boolean =>
  new Set(taken).has(wanted.trim());
