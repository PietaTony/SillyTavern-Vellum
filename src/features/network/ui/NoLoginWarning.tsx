/**
 * 「Vellum 沒有登入機制」那一段警告的**唯一一份文案**。
 *
 * 🔴 已設存取密碼時改講另一件事 —— 風險仍在（區網可掃 port），但不再等於裸奔。
 */
export function NoLoginWarning({ hasPassword = false }: { hasPassword?: boolean }) {
  if (hasPassword) {
    return (
      <>
        <b>已設定存取密碼</b> —— 連進來的人仍要先登入。但同一個 wifi 上的人<b>可能會嘗試連線</b>
        ，請仍優先使用 Tailscale。
      </>
    );
  }
  return (
    <>
      <b>Vellum 沒有登入機制</b> —— 連得到的人可以讀你全部的對話、用你的 API 金鑰花錢。
    </>
  );
}
