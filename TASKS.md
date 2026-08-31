# Vellum UI ── 畫面清單與檢查進度

## 🔴 這條線（vellum-ui / `ui/polish`）2026-08-27 收掉了 —— 接手的人先讀這段

**分支還在，但沒有人在這棵樹上了。裡面有沒合出去的東西。**
實查（2026-08-27 深夜，`git rev-list`）：

- `ui/polish` **領先 `origin/staging` 17 個 commit**（全部**沒有 push**、**沒有開 PR**）
- ⚠️ 同時**落後 staging 3 個**：`6394ddb58`（第三方授權聲明）、`715d4efb5`＋`cc89da00d`
  （`AGENTS.md` 與 `.claude/agents/` 七支功能面 agent 定義）
  ⇒ **合併方向是先把 staging 那 3 個拉進來，再把這 17 個推出去。**

### 那 17 個裡面最不能弄丟的
1. **VENDOR 三支落地內嵌，我們自己零外連**（`05e0a1856`／`dd6ac19e0`）——
   lodash 4.17.21／jquery 3.7.1／js-yaml 4.1.0 走 npm 鎖版本、`vendor/` 有 README，
   `VENDOR_HOSTS` 因此變成 `[]`（同意視窗少一項要跟使用者解釋的風險）。
2. **`mvuShim` —— 自己扮演 MVU，不引入外部 Vue／zod**（`3ae398fdb`）。規格正本在
   `src/features/cardscripts/runtime/mvuShim.ts` 與 `runtime/globals.ts` 的**檔頭**
   （理由、取捨、實機 stack 都在裡面），但**那兩支檔就在這 17 個 commit 裡**
   ⇒ 沒合過去的話，這個決定會跟著這條線一起消失。摘要見下面「決策正本」。
3. **變數引擎接上產品端**（`a8c6b22aa`／`3f1b3b704`／`c5be7a072`）——
   `<UpdateVariable>` 真的會改到數值、寫進 `stat_data`、開場白的起始值會落地。
4. iframe console／CSP 轉發線（`c21921780`／`5c38b977d`）、502 錯誤頁與診斷單
   （`b2f6fc73a`／`a596c24a1`／`811f98339`）、世界書分組預設折疊（`c5c734f77`）。

### 決策正本：為什麼「自己扮演 MVU」而不是補 Vue／zod
卡片從 CDN 載 MVU（MagVarUpdate），而它假設沙箱有全域 `Vue` 與 `z`(zod)。我們沒有
⇒ 實機當場兩發未接住的例外（`Vue is not defined`／`z is not defined`）⇒ MVU 從來沒
初始化 ⇒ 卡片 `await waitGlobalInitialized('Mvu')` 永遠等不到 ⇒ `init()` 一行都沒跑過。
**不補那兩個依賴的理由**：那等於把產品的核心狀態（親密度／安全感／面具）押在別人的
CDN 上 —— 斷網或對方改版就沒有狀態，而且測不到。而 MVU 要做的事我們本來就有
（`lib/varUpdate.ts` 解析、`lib/varApply.ts` 夾持後套用，還多做了 MVU 不會做的約束）。
⇒ Peter 2026-08-27 裁定「我們要相容這張卡，用我們的方式，安全地完成」「我不想要引入
外部的 Vue」。⇒ shim 只補「卡片認得的那個介面」：實掃 4 張卡，`Mvu.` 只有一種用法
（`Mvu.events.VARIABLE_UPDATE_ENDED`）⇒ 殼只要有 `events` 就夠。
⚠️ 代價：事件名是我們自己定的；卡片若把字串寫死而不是讀 `Mvu.events.…` 就會漏接
（這張卡沒有）。`window.Mvu` 只在沒有人定義過時才裝 —— 真的 MVU 有天跑得起來時它該贏。

### 這條線原本的地盤 ＝ staging 上的 `H6 card-scripts`
`AGENTS.md`（在 staging，這棵樹上看不到）把工作切成七支功能面 agent，
「一個檔案只有一個寫入者」。這條線做的卡片腳本那一塊對應 **H6 card-scripts**。
🔴 2026-08-27 Peter **當面**（不是同事轉述）把三支 `server/` 交給這條線：
`services/applyVarUpdate.ts`、`lib/mvuStage.ts`、`routes/generate.ts`，
深夜再加 `routes/chats.ts`。接手的人要確認這幾支在新的 owner 表上算誰的。


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
- [ ] 長按訊息的動作選單 ── 觸控按住 500ms／桌機右鍵，四項
- [ ] 就地編輯訊息 ── 從上面那個選單進去（🔴 儲存要等後端端點）
- [ ] 刪除／重新生成的確認框 ── 兩個都不可逆
- [ ] 切換開場／切換候選（SwipePicker）── 點 swipe 的計數器
- [ ] 卡片程式同意（ConsentDialog）
- [ ] 生成失敗橫幅 ── 送訊息但沒金鑰時

### 設定頁
- [ ] 全站背景（BackgroundsLayer, global）── 有即時預覽框

### 其他
- [ ] 世界書條目分組 ── **預設折疊**，收起時看得到「開了幾條」；記住打開過哪幾組
- [ ] 「回報問題」的四個入口 ── 錯誤頁／`/settings`／對話頁 ☰／失敗橫幅，
      再加 tips 上那顆複製鈕（複製的是整張回報單）
- [ ] 世界書選擇器（WorldPicker）── persona 編輯裡
- [ ] 全站 tips（ToastStack）── 會堆疊
- [ ] 區網連線警告（LanWarning）── 用 `192.168.x.x` 開才會出現

## 伺服器忽然死掉 —— 查到哪了（2026-08-27）
症狀：`18530` 的畫面活著，所有 `/api` 回 502。後端 `18531` **沒有人在聽**，
但 `tsx watch` 那層還活著 ⇒ 真正的 server process 自己退掉了。
🔴 **`tsx watch` 不會在 crash 之後自動重起**（它只在檔案變動時重起）——
所以死一次就會一直是 502，而且看起來像前端壞了。

已排除：前端檔案變動不會觸發後端重啟（實測 `touch src/.../Thread.tsx`，log 沒動）。
還沒有原因：第一次死的時候輸出沒有落檔，process 也清掉了。**不猜。**

現在有的證據鏈（Peter 2026-08-27：「先不要自動重啟，我要找到原因」）：
- `scratchpad/run-server.sh` 起後端，輸出 append 到 `/tmp/vellum-ui-server.log`，
  每次啟動印 `START`、退出印 `EXIT code=`（node 的 uncaught 例外本來就會印到 stderr）
- `scratchpad/watch-server.sh` 每 5 秒探 `18531`，**只記錄不重啟** ——
  上次那種死法（tsx 活著、沒人在聽）不會觸發 `EXIT`，所以要有人記下「幾點開始沒人聽」

⚠️ 沒有 `process.on('uncaughtException'/'unhandledRejection')`（`server/index.ts`）——
Node 遇到 unhandled rejection 預設**直接終止行程**。要不要補是主執行線的決定（`server/` 是禁區）。

## vendor 落地（2026-08-27）
lodash／jQuery／js-yaml 三支從 CDN `<script src>` 改成**整份內嵌進 srcdoc**。
🔴 原本 `https://testingcf.jsdelivr.net/npm/lodash/lodash.min.js` **沒有 `@版本`**
⇒ jsdelivr 給最新版，上游一發新版卡片就換了引擎，而我們測不到；而且是測試 CDN。
現在檔案 commit 在 `vendor/`（來源是鎖版本的 npm 套件，`vendor/README.md` 有更新指令）。
⇒ **`VENDOR_HOSTS` 是空的**：同意視窗上剩下的每一個網域都是卡片自己要去的。
實測：載入那一頁，主頁對外部網域的請求 **0 次**；兩個 frame 的 srcdoc 都不含
`<script src="https`，而 jQuery 在裡面。

## 卡片變數：資料鏈路通了，畫面還沒（2026-08-27）
Peter 2026-08-27 授權 UI 線接手 `server/`，變數引擎已接上（`services/applyVarUpdate.ts`
→ `routes/generate.ts` 的 `commitTurn`）。實測（不花錢，直接跑服務餵一段假回覆）：
```
生成前：只有桌寵存的東西
[vellum] 變數：安全感 15→17、面具 85→82（變化量被夾回 ±3（想要 55））、親密度 20→21
        ｜拒絕 時期、不存在的東西
生成後：時期=成年、安全感=17、面具=82、親密度=21，桌寵那份原封不動
```
⇒ 夾持生效並留痕跡、唯讀擋得住、未宣告丟得掉、不覆蓋卡片自己存的東西。
變數也確實種進 iframe 了（`__vellumVars` 讀得到那四個）。

🔴 **2026-08-27 找到了：值寫錯地方。** 卡片讀的是 `getAllVariables().stat_data`
（桌寵的 `readState()`），那是 MVU 的慣例；我們扮演 MVU 卻把值寫在頂層 ⇒ 它一個都讀不到，
**而且畫面上沒有任何錯誤，只有三個 `—`**。是 Peter 的手機截圖看出來的：
面板上「時期」有值、三個數字是 `—` —— 那個不對稱就是指紋。
已改成寫進 `stat_data`，並一起存卡片 schema 會 transform 出來的 `階段`。
實測：`stat_data: {時期:成年, 安全感:17, 面具:82, 親密度:23, 階段:接近}`，桌寵那份沒被動到。

挖到哪了（2026-08-27）：
- ✅ 卡片**畫得出來也跑得動**：載入時探到 `toggleHsn=function`、`card=true`、`jq=function`，
      module 腳本有執行、沒有任何例外、沒有 CSP 攔阻。
- ✅ 數值**有填進 HTML**（開場白那張是 15/85/20）—— 那是**開場白當下的快照**，
      由 outputRules[10] 用 `<思年>` 的擷取群組填的，**設計上就不會跟著變**。
- [ ] 🔴 **狀態卡點了不展開**：`.hsn-header` 的 `onclick="toggleHsn()"` 沒有被觸發，
      因為**點擊根本沒有進到 iframe 的 document**（在 iframe 裡掛 capture 階段的 click
      監聽器，一次都沒收到）。已排除桌寵覆蓋層（把它 `display:none` 照樣沒進去）。
      ⚠️ **也可能是自動化的假象** —— 這整個 session 沒有任何一次點擊被證明進過 iframe，
      而主頁的按鈕全都點得動。**請 Peter 在真的瀏覽器上點一下那張卡的標題列**：
      展得開 ⇒ 是我的工具；展不開 ⇒ 是產品的命中測試問題。
- [ ] 🔴 **「每一則回覆都有即時狀態欄」是另一個獨立缺口**：那要靠 outputRules[9]，
      而它的觸發條件是訊息裡有 `<StatusPlaceHolderImpl/>` —— **沒有任何人放它**
      （整份角色 JSON 與世界書掃過，只有規則 8/9 的 `find` 欄位有這個字）。
      ST 那邊是 MVU 用提示詞注入放的，而我們沒有「讓卡片注入提示詞」的路。
      要嘛我們自己在提示詞裡要求模型輸出它，要嘛落地時自己補上 —— **要 Peter 決定**。

## 已知未做 / 未驗
- [ ] **長按選單的「編輯／刪除／重新生成」按下去會 404** ── 後端還沒有那兩支端點
      （規格已寫成 prompt 交付，見下）。前端會跳一則說明原因的 tips，不是靜默失敗。
- [ ] **「複製文字」沒在實機驗到** ── 自動化開的是背景分頁，Chrome 的
      `navigator.clipboard.writeText` 在 `visibilityState === 'hidden'` 時
      **promise 不會 settle**（實測 1.2s 仍 pending）⇒ 連 tips 都不會跳。
      前景分頁應該正常，但要你手點一次確認。
      ⚠️ 順帶一提 `src/shared/lib/copyText.ts`（UI 線不能改）沒有 timeout，
      那條路一旦卡住就是「按了、什麼都沒發生」——要不要補 timeout 由你決定。
- [x] 卡片內「選開場線」選完之後沒有自動設定世界書 ── **查到了，病灶在後端**（見下）
- [ ] `/settings` 的「外觀」── 標著「還沒做」
- [ ] persona 圖生文的 prompt 不對味 ── 等主執行線加 persona 版 prompt（prompt 已交付）
- [ ] 桌寵點擊的動畫範圍 ── Peter 回報，我點了多次沒能重現，**等截圖**
- [ ] 桌寵**尺寸**仍會重置 ── 卡片存在 iframe 的 localStorage，而我們的沙箱是 opaque
      origin ⇒ 那支 API 用不了。要嘛卡片改存變數，要嘛我們補一層 shim
- [x] 親密值有沒有真的開始更新 ── **沒有，而且從來沒有過**。把 iframe 的 console 轉發
      出來之後當場看到：MVU 一載入就炸
      `ReferenceError: Vue is not defined`（MagVarUpdate/artifact/bundle.js）
      `ReferenceError: z is not defined`（tavern_resource/dist/util/mvu_zod.js）
      ⇒ MVU 從來沒初始化 ⇒ 卡片的 `await waitGlobalInitialized('Mvu')` 永遠等不到
      ⇒ 狀態欄不更新、`Mvu.events.VARIABLE_UPDATE_ENDED` 也從來沒訂到。
      🔴 我們的 `VENDOR` 只給 lodash／jquery／js-yaml，**沒有 Vue 也沒有 zod**
      （酒館助手是自己 bundle 這兩個給 iframe 用的）。**要不要補是 Peter 的決定**：
      補＝多兩條外連、同意視窗的網域清單會變長。

## 🔴 下一輪第一件：等 Peter 在真手機上驗一件（2026-08-27 深夜）
**開一段新對話，打開桌寵面板，看四個欄位是不是真的有數字。**
我在跑著的 `:18531` 上用 API 驗過兩條路（下面「已修」那條），但**桌寵面板長什麼樣沒驗到**
—— 合成點擊整個 session 沒有一次被證明進得了跨來源 iframe（Peter 已確認展得開 ⇒ 那是工具的限制，
不是產品的命中測試問題，該項結案）。現成可以開的兩段：
- `d8a2d0f1`（童年線）應該是 童年 / 10 / 60 / 0 / 警戒
- `2eb23918`（建成年線再換到學生線）應該是 學生 / 15 / 70 / 5 / 同學
⚠️ **`d453cfed`／`df42ab8b` 這些舊的開發對話不用看** —— 它們是修好之前建的，
`df42ab8b` 的值還被寫在頂層（20:50〜21:23 那版程式）。Peter 裁定：不寫遷移，重開對話就好。

### ✅ 已修：桌寵面板三個「—」的根因（不在桌寵）
Peter 回報「桌寵有顯示，但是親密度都沒有正確」。查下去是**開場白落地時沒有人算變數**：
`varsAfter()` 唯一的呼叫端是 `commitTurn()`，只在生成時跑；開場白是 `chats.ts` 直接寫成
第 0 則的 ⇒ 九則開場白裡**八則帶的 `<UpdateVariable>` 從來沒被套過** ⇒ 新對話沒有
`stat_data` ⇒ 卡片 `_.get(all,'stat_data',{})` 拿到空物件 ⇒ 面板三個 `—`、`時期` 掉回
卡片自己的 fallback `成年`。**「引擎接好了、沒有門」的第六次，一樣完全靜默。**
🔴 更嚴重的一半：三則開場白會把 `時期` 設成 `童年`／`學生` ⇒ 在此之前**選童年線的對話
會拿著成年線的 15/85/20 開局**。修法見 `server/services/seedGreetingVars.ts` 檔頭。

## 還沒解的兩件（都要 Peter 決定）
- **「每一則回覆都有即時狀態欄」**：靠 `outputRules[9]`，觸發條件是訊息裡有
  `<StatusPlaceHolderImpl/>` ── **沒有任何人放它**（整份角色 JSON 與世界書掃過，
  只有規則 8/9 的 `find` 欄位有這個字；尺自檢：同一次掃描抓到 972 個含「思年」的字串）。
  ST 那邊是 MVU 用提示詞注入放的。兩條路：① 我們在提示詞裡要求模型每輪輸出它
  ② 落地時我們自己補上（比較確定，但那是我們動了模型的輸出）。
  🔴 **2026-08-27 補的證據 ── 這條沒解的話「訊息上的數字」永遠是錯的**：
  現在畫面上看得到的狀態卡是 `outputRules[10]`（開場白狀態欄），它用正規表示式從
  **訊息文字**裡抓 `<思年>…安全感：15 面具：85 親密度：20…</思年>`，把 `$3/$4/$5`
  直接畫上去 ⇒ **那是模型當時寫的字，不是引擎夾持後的真值，而且永遠不會更新**。
  真正會讀 `stat_data` 的是規則 9，而它從來沒被觸發過。
  ⚠️ 實檔佐證：`d453cfed` 17 則訊息裡**只有第 0 則有 `<思年>`**，後面每一則都有
  `<UpdateVariable>` 但沒有 `<思年>` 也沒有 placeholder ⇒ 第一則之後根本沒有狀態欄。
  （桌寵面板不吃這條 —— 它自己直接讀 `stat_data`，已經修好了。）
  🔴 **2026-08-27 上網查到的定義域（這條的答案偏向 ②）**：`<StatusPlaceHolderImpl/>`
  **是框架層自己補的，不是要模型輸出**。MVU-zod 的文件寫「MVU 在 AI 回復結束後自動附加
  `<StatusPlaceHolderImpl/>`」，然後配**兩條正則**：一條送 AI 前移除（省 token）、
  一條顯示時換成界面代碼 —— 我們這張卡的 `outputRules[8]`(target=prompt) ＋ `[9]`(display)
  正是那一對。⇒ 我們既然自己扮演 MVU，**補它就在我們的定義域內**，不是「動了模型的輸出」。
  ⚠️ 但**補在哪一步要我們自己決定**（存檔時 vs 顯示時），MVU 是在它自己的流程裡補。
  ⚠️ 還有一個我們沒有的前提：MVU **每則訊息一份變數快照**，我們沒有 `message` 範圍的變數
  ⇒ 就算補了，每一則的狀態欄都會顯示**當下最新**的值，不是那一樓當時的值。
  ⚠️ 以上是兩份獨立文件互相佐證（ERA 的文件、MVU_ZOD 指南），**沒有讀 MVU 原始碼確認**。
- **`scripts/verify-vars.ts` 有一份跟 `applyVarUpdate.schemaOf()` 一模一樣的手寫 schema**
  ── 兩份會漂。該讓它改吃那一支（`scripts/` 目前仍是禁區）。

## 交給主執行線的（已寫成 prompt 交付）
- 🔴 **一則訊息要有兩個版本**（原文給卡片與 prompt、顯示版給畫面）。
  現在 `GET /api/chats/:id` 只回顯示版，而 `<UpdateVariable>` 正是被顯示規則拿掉的那塊
  ⇒ **重整之後卡片再也讀不到變數更新**。⚠️ `generate.ts` 的 `done` 送原文是目前唯一的窗口，
  **不要單獨修它**。建議加 `raw` 欄位不改既有語意。規格在
  `scratchpad/prompt-message-two-versions.md`。
- ✅ ~~切開場永遠不會重算世界書~~ ── **已修**（`87df3a7fb`，`lib/greetings.ts` 的
  `greetingForSwipe()` 現在比的是同一個單位）。2026-08-27 深夜順手實測：建立成年線再切到
  學生線，世界書與起始變數兩邊都重算了。
- 🔴 **bridge 有四支「假的」API**：`getLorebookEntries`／`setLorebookEntries`／
  `updateWorldbookWith`／`SillyTavern.getContext()` —— 回空值、靜默、看起來像有實作。
  目前這張卡沒叫到，但換一張會動世界書的卡就會中。要嘛做，要嘛像 `generate()` 一樣丟例外。
  另有 `getCurrentMessageId()` 語意（＝最後一則，ST 是「呼叫它的那一則」）與
  `eventEmit` 不存在（可能是 MVU 事件收不到的原因，**未驗證**）。同一份 prompt 裡。
- 🔴 **對話訊息的「改內容」與「刪除」兩支端點**（長按選單缺的就是這個）：
  · `PATCH  /api/chats/:id/messages/:messageId`  body `{ text }`
    —— **有候選的訊息要一併寫回 `swipes[swipeIndex]`**，只改 `text` 的話
    切走再切回來就被蓋掉，看起來像「存了又自己變回去」。
  · `DELETE /api/chats/:id/messages/:messageId[?cascade=1]`
    —— `cascade=1` ＝ 連同之後的一起刪，「從這則重新生成」用它。
  完整規格（含回應形狀與第一則開場白的邊界）在
  `scratchpad/prompt-message-endpoints.md`。
  🔴 端點到位後，UI 線要把 `src/app/screens/messageActions.ts` 的三支 `fetch`
  搬進 `features/chat/api.ts`，並拿掉那段 404 特判。
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

## `server/lib/companion.ts` 是孤兒引擎（2026-08-28，E1 稽核時查到，刻意不動）
查 E1（桌寵開關）時發現：`server/lib/companion.ts`（P7 原生桌寵引擎，`sequenceFor`／
`frameRect`／`checkCompanion` 那組純函式）**零呼叫端** —— `grep -rn "companion"
server/routes/ src/` 只命中它自己的測試（`server/__tests__/companion.test.ts`）與
`scripts/verify-companion.ts`（B8／C1b 停損線）。沒有任何路由回傳 `Companion` 設定，
沒有任何畫面元件渲染它。

**現在實機真的在跑的桌寵，跟這支完全無關**——是卡片自己的 `tavern_helper.scripts[6]`
（2.06MB），整支丟進沙箱 iframe 跑，走 `CardBackground.tsx` 的 `mode="overlay"`
那個 frame，讀寫的是它自己的 `stat_data`。E1 的「桌寵開關」關的也是這個 overlay
frame（讓它整個不建），不是 `companion.ts` 這支。

⇒ **這不是「原生桌寵引擎的殘骸」，是規格 P7 還沒被兌現的後半**：呈現層原語
（sheet／atlas／sequences／stateMap／百分比切格）已經照真卡的形狀移植好、通過
`verify:companion` 的驗收，缺的是①一個回傳 `Companion` 設定的路由、②前端一個
實際渲染它的畫面元件。這兩件都不在任何一個 agent 現有的檔案清單裡，是一次新功能
立項，不是清理範圍。

🔴 **Peter 2026-08-28 裁定：這一輪刻意不動這支檔**，只留這筆紀錄——
不要誤讀成待辦，下一個要接 P7 的人先讀這段再決定要不要立項。
