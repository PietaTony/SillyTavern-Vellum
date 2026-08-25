/** 純函式。D20b：建立角色只留四欄。 */
export type Draft = { name: string; description: string; firstMessage: string; avatar: string };

export const emptyDraft: Draft = { name: '', description: '', firstMessage: '', avatar: '' };

/** 🔴 「建立角色」的解鎖條件：名稱填了才准按（F22–F28）。ST 的必填也只有名稱。 */
export const canCreate = (d: Draft): boolean => d.name.trim().length > 0;
