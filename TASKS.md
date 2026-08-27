# Vellum UI ── 畫面清單與檢查進度

> vellum-ui（UI 線）維護。**打勾＝Peter 實機看過而且認可**，不是「code 寫完了」。
> 檢查完一項就把 `[ ]` 改成 `[x]`；有問題的寫在該列後面。

## 路由（有網址的頁）

### 首次啟動 ── 沒設定過金鑰時，**所有網址**都會被導來這裡
- [ ] `/first-run/provider` 選擇供應商 ── 26 家清單，與 `/settings/providers` 同一份
- [ ] `/first-run/key?id=` 取得金鑰 ── 與 `/settings/providers/$id` 同一份 ＋「下一步」
- [ ] `/profile?setup=1` 你是誰 ── persona，可跳過；有「透過圖片自動生成內容」
- [ ] `/first-run/add-friend` 加入好友（首次流程版）

### 主要分頁（底部 TabBar）
- [ ] `/chat-list` 聊天 ── 最近對話
- [ ] `/friends` 好友 ── 全部角色卡
- [ ] `/worlds` 全域世界書 ── 最上方有「建議暫時不要使用」大字警告
- [ ] `/settings` 設定

### 對話
- [ ] `/chat/$chatId` 對話串 ── swipe 上下兩條、生成中 loading、失敗橫幅

### 好友
- [ ] `/add-friend` 加入好友（設定完成後的入口）
- [ ] `/import/drop` 匯入角色卡

### 世界書
- [ ] `/worlds/$worldId` 單本世界書 ── 摘要＋線路收合＋條目清單
- [ ] `/worlds/$worldId/$uid` 條目編輯 ── 右上角「儲存」才會存
- [ ] `/worlds/bindings` 世界書怎麼套用 ── 四層說明

### 設定
- [ ] `/settings/providers` AI 供應商與金鑰 ── 26 家
- [ ] `/settings/providers/$id` 單一供應商 ── 金鑰＋模型
- [ ] `/settings/network` 其他裝置 ── Tailscale／區網警告
- [ ] `/settings/about` 關於與更新

### 沒有畫面的（純導向，順手確認不會卡住就好）
- [ ] `/` 首頁 ── 依「設定完了沒」分流到 chat-list 或 first-run
- [ ] 亂打網址 ── 設定過→`/chat-list`；沒設定過→`/first-run/provider`

## 全螢層 / 彈窗（沒有網址，從某個頁面打開）

### 對話頁 ☰
- [ ] 我是誰（PersonaLayer）
- [ ] 對話背景（BackgroundsLayer, chat）── 有即時預覽框
- [ ] AI 供應商與金鑰（ProvidersLayer）→ 點進單一供應商是層中層
- [ ] 換開場（GreetingsLayer）
- [ ] 停止執行這張卡的程式

### 對話頁 其他入口
- [ ] 角色設定（CharacterLayer）── 點頭像
- [ ] └ 世界書（WorldSection）── 層中層
- [ ] &nbsp;&nbsp;└ 單一條目（WorldEntryLayer）── 層中層中層
- [ ] 切換開場／切換候選（SwipePicker）── 點 swipe 的計數器
- [ ] 卡片程式同意（ConsentDialog）
- [ ] 生成失敗橫幅 ── 送訊息但沒金鑰時

### 設定頁
- [ ] 全站背景（BackgroundsLayer, global）── 有即時預覽框

### 其他
- [ ] 世界書選擇器（WorldPicker）── persona 編輯裡
- [ ] 全站 tips（ToastStack）── 會堆疊
- [ ] 區網連線警告（LanWarning）── 用 `192.168.x.x` 開才會出現

## 已知未做 / 未驗
- [ ] `/settings` 的「外觀」── 標著「還沒做」
- [ ] persona 圖生文的 prompt 不對味 ── 等主執行線加 persona 版 prompt（prompt 已交付）
- [ ] 桌寵點擊的動畫範圍 ── Peter 回報，我點了多次沒能重現，**等截圖**
- [ ] 桌寵**尺寸**仍會重置 ── 卡片存在 iframe 的 localStorage，而我們的沙箱是 opaque
      origin ⇒ 那支 API 用不了。要嘛卡片改存變數，要嘛我們補一層 shim
- [ ] 親密值有沒有真的開始更新 ── 事件確定發出去了（測試守著），但要跑完一整輪
      生成、而且知道正確數值才驗得了

## 交給主執行線的（已寫成 prompt 交付）
- `server/adapters/gemini.ts:107` 的 from-image prompt 只寫給角色用，persona 那邊
  生出來是第三人稱簡介。建議加 `kind: 'character' | 'persona'`，省略時等於 character。
  🔴 若改了 request 形狀，UI 線這邊 `characters/api.ts` 與兩個呼叫端要跟著改。
- `hostKind()`（`features/network/hostKind.ts`）與 `server/adapters/network.ts` 的
  `isTailscale()` 是同一條 CGNAT `100.64.0.0/10` 的兩份實作 —— 改判準時兩邊一起改。

## 這一輪修掉的（PR #3 已合、#4 待審）
PR #3（八項，已合進 staging）：錯誤橫幅吐 JSON／模型下拉變輸入框／first-run 必經
＋亂打網址回 chat-list／Tailscale 兩邊警告／「下一步」回歸／persona 圖生文／
生成中 loading ＋接上被丟掉的 `thinking`／背景即時預覽。

PR #4（三項，待審）：輸入框當場清空＋LINE 式黏底與「回到最新」／桌寵位置不再重置／
卡片腳本終於收得到事件（`emitToCards` 原本有零個呼叫端）。

🔴 **這一輪的共同形狀是「引擎接好了、沒有門」**，一共三個：
被丟掉的 `thinking` 事件、沒人讀的 `manual` 旗標、零呼叫端的 `emitToCards`。
下次看到「某某功能沒反應」，先查那條路徑的**最後一哩有沒有人接**。
