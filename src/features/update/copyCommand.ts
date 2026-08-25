/**
 * 更新指令與「為什麼不能一鍵」的文案 —— 正本只有一份。
 *
 * 🔴 原本兩者都寫死在 `UpdateBanner.tsx` 裡。設定頁「關於與更新」需要同一段文案
 * （複製指令的按鈕、按鈕旁的說明），拆出來才不會兩處各自維護一份會漂走的複本。
 */
export const UPDATE_COMMAND = 'docker compose pull && docker compose up -d';

export const UPDATE_COMMAND_WHY = `為什麼不是按一下就更新完：容器沒辦法自己換掉自己的 image。
要做到真正的一鍵，得把 docker.sock 掛進容器 —— 那等同把主機的 root 權限交出去，
為了省一次貼上不值得。
另一個理由：更新前你應該先看過這一版改了什麼。`;
