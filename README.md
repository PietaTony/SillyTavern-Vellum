# Vellum

本機單人的 LLM 角色扮演與長對話 app。**你的角色卡、對話、金鑰都留在你自己的電腦上。**

> ⚠️ **目前是 Alpha 版本。** 功能還在快速增減，畫面與操作方式**可能在版本之間直接改變**，
> 不保證每一版都相容。重要的對話與角色卡建議自己另外留一份。

**[SillyTavern](https://github.com/SillyTavern/SillyTavern) 的分支（fork）** —— 後端以 **Hono** 重寫（`server/`，沿用 ST 的 API 與資料語意），前端整個重寫。
功能一樣，UI／UX 大改。

授權 **AGPL-3.0-or-later**（見 [`LICENSE`](LICENSE)）—— 上游是 AGPL，分支也必須是。
git 歷史保留了完整的來源鏈（第一個 commit 是 SillyTavern 作者 Cohee，2023-07-20）。

> 🔴 **要把它架起來給別人用的話先看這一段。**
> AGPL §13：**把修改過的版本架起來讓別人透過網路使用，就必須讓那些使用者取得對應的原始碼。**
> 義務在**營運方**身上。
> ⇒ app 的「設定 → 關於與更新」裡有「取得原始碼」入口，
> **改過的話請設 `VELLUM_SOURCE_URL` 指到你自己的原始碼位置** ——
> 不改的話那顆按鈕會把你的使用者帶到我們的 repo，那不是你正在跑的那一版。
> AGPL **允許收費**，但不允許不給源碼。

---

## 給 agent／新協作者

1. [`ARCHITECTURE.md`](ARCHITECTURE.md) — 專案地圖與閱讀順序（**先讀**）
2. [`AGENTS.md`](AGENTS.md) — 哪個檔案誰能改
3. [`.claude/agents/<domain>.md`](.claude/agents/) — 該領域 GAP；或搜 [`docs/generated/gap-index.md`](docs/generated/gap-index.md)
4. `pnpm verify` — 唯一收據；改完貼真實輸出
5. 深度規格／ticket — agents home 的 `plans/`、`INBOX/`（路徑見 ARCHITECTURE.md §5）

---

## 安裝

Windows／macOS 步驟一樣。**不需要 Docker**，也不需要裝 pnpm 或 git。

### 1. 裝 Node.js

到 <https://nodejs.org> 下載 **LTS 版**（左邊那顆綠色按鈕）。需要 **20.19 以上**。

> 已經裝過的話，在終端機／命令提示字元打 `node -v` 看一眼就知道版本。

### 2. 下載 Vellum

到 [Releases 頁](https://github.com/PietaTony/SillyTavern-Vellum/releases) 下載
`vellum-vX.Y.Z.zip`，**解壓到一個你找得到的資料夾**。

> 這個資料夾之後會裝著你的角色卡、對話、金鑰。

### 3. 啟動

| 系統 | 雙擊 |
|---|---|
| macOS | `啟動.command` |
| Windows | `啟動.bat` |

第一次在 macOS 上可能會說「無法打開，因為來自未識別的開發者」——
在那個檔案上**按右鍵 → 打開 → 再按一次「打開」**，之後就不會再問。

### 4. 瀏覽器會自動打開 <http://127.0.0.1:8520>

沒自動打開就自己輸入這個網址。**網址永遠是這個，不會變**，加書籤就好。
要換 port 的話設 `PORT` 環境變數。

### 5. 設定 API 金鑰

app 會帶你走一次：選供應商 → 貼金鑰 → 測試連線 → 加第一個好友。
**測試不過就不會讓你往下走**，不會讓你設定完才發現金鑰是錯的。

### 怎麼停止

**關掉那個終端機視窗**就是停止。

---

## 或者用桌面版（不用開終端機）

Releases 頁上也有桌面版 —— macOS 的 `.dmg`、Windows 的安裝檔／免安裝 `.exe`。
雙擊就開，**不需要另外裝 Node.js**。

> ⚠️ **桌面版的資料放在別的地方**：不是在 app 旁邊，而是系統的使用者資料夾
> （macOS 是 `~/Library/Application Support/sillytavern-vellum/data`）。
> `.app` 會被拖進 `/Applications`，那裡是唯讀的，寫在旁邊會失敗。
>
> 🔴 **目前的桌面版沒有簽章。** Windows 會跳 SmartScreen 警告（可以按「仍要執行」）；
> **macOS 從瀏覽器下載的 `.app` 會被 Gatekeeper 擋住打不開** —— 要真正給別人用，
> 得先買 Apple Developer（US$99/年）做簽章與公證。在那之前，**Mac 請用上面的 zip 版**。

---

> 🔴 **`./data` 這個資料夾就是你的全部身家**（角色卡、對話、世界書、金鑰）。
> 它跟啟動檔放在一起，**備份就是複製這個資料夾**。
> 想放到別的地方就設 `VELLUM_DATA` 環境變數。

<details>
<summary>想自己從原始碼 build？（需要 Node 24 與 corepack）</summary>

```bash
git clone https://github.com/PietaTony/SillyTavern-Vellum.git
cd SillyTavern-Vellum
corepack enable          # pnpm 是 Node 內建的，不用另外裝
pnpm install
pnpm start:fresh         # build 完直接跑
```

`.npmrc` 釘死 Node 24.15.0（jsdom 30 的 engines 要求）。
只是要**跑**預先 build 好的 zip 的話，Node 20.19 就夠了。
</details>

---

## 環境設定

**一般使用完全不用設。** 下面這些是「想改預設行為」時才用得到的。

設定方式：在啟動檔裡加一行（macOS `export X=y`、Windows `set X=y`），
或在終端機裡 `X=y node dist-server/index.mjs`。

| 變數 | 預設 | 做什麼 |
|---|---|---|
| `PORT` | `8520` | 換 port。網址跟著變 |
| `HOST` | `127.0.0.1` | 🔴 **只有這台電腦連得到**。設 `0.0.0.0` 才對外 —— 先看下面的安全性那段 |
| `VELLUM_DATA` | `./data` | 資料放哪。**你的角色、對話、金鑰全在這個資料夾** |
| `VELLUM_ALLOWED_HOSTS` | 空 | 自訂網域要連進來時填（逗號分隔）。預設只接受 loopback／IP 字面值／`.ts.net` |
| `VELLUM_OPEN` | 關 | 設 `1` 會在啟動後自動打開瀏覽器。**啟動檔已經幫你設好了** |
| `VELLUM_SOURCE_URL` | 我們的 repo | 🔴 **改過並架給別人用的話一定要設**（AGPL §13）—— 見上面授權那段 |

> ⚠️ **`VELLUM_ALLOWED_HOSTS` 不是「開放清單」，是防 DNS rebinding 的白名單。**
> 沒設也連得到自己的 IP 與 Tailscale 網域；設了是為了自訂網域，不是為了開權限。

**開發時另外還有這幾個**（只有 `pnpm verify:*` 那幾支腳本會讀）：
`VELLUM_CARD`／`VELLUM_CARD_URL`／`VELLUM_CHAT`／`VELLUM_WORLD` —— 指定要驗證的素材檔。

---

## 更新

app 裡有新版時會直接告訴你。更新是三步：

1. 到 [Releases 頁](https://github.com/PietaTony/SillyTavern-Vellum/releases) 下載新版 zip，解壓到一個**新的**資料夾
2. 🔴 **把舊資料夾裡的 `data/` 整個複製過去** —— 你的角色、對話與設定都在裡面
3. 開新資料夾的啟動檔；確定沒問題之後才刪掉舊資料夾

> **為什麼不是按一下就更新完**：這個 app 就是你電腦上的一個資料夾，
> 它沒辦法在執行中把自己換掉，也不該有權限刪你的檔案。
> 而且更新前你應該先看過這一版改了什麼 —— 尤其是標著破壞性變更的那幾版。

> 🔴 我們**不做自動更新**。理由是同類專案（Open WebUI）的實際教訓：
> 版本一旦帶破壞性變更或資料遷移，自動更新會在你不知情的時候弄壞你的東西。
> ⇒ **通知你，由你決定什麼時候更新。**

---

## 🔴 安全性：先看這一段再決定要不要對外開

**Vellum 沒有登入機制。** 這是刻意的 —— 它被設計成**單人在自己電腦上跑**的 app。

⇒ **任何連得到那個 port 的人，都等於是你。** 他能讀你全部的對話、
用你的 API 金鑰花錢。所以：

| 情境 | 安全嗎 |
|---|---|
| 預設（綁 `127.0.0.1`） | ✅ 只有這台電腦連得到 |
| 透過 **Tailscale** 給自己的手機用 | ✅ tailnet 是私有網路，只有你的裝置在裡面 |
| 設 `HOST=0.0.0.0` 接到家裡 wifi | ⚠️ **同一個網路上的人都連得到**，室友、訪客、被入侵的裝置 |
| 直接開到公網 / port forwarding | 🔴 **不要這樣做** |

> 之後會加密碼保護，讓「架給別人用」變成安全的選項。**在那之前，請只用前兩種。**

已經做的防護（都有測試與實測收據）：

- **路徑穿越**：URL 參數只允許 `[A-Za-z0-9_-]`，資料層另外夾住資料目錄（兩層）
- **DNS rebinding**：只接受 loopback／IP 字面值／`.ts.net` 的 `Host`，
  自訂網域要明確設 `VELLUM_ALLOWED_HOSTS`
- **上傳大小**：8 MB 上限，塞不爆磁碟
- **零 CORS**：有一支測試釘住它，加一行 `Access-Control-Allow-Origin` 就會紅
- **卡片腳本關在 sandbox iframe 裡**（不給 `allow-same-origin`），讀不到你的其他對話

## 從手機或平板連進來

預設**只有這台電腦連得到**（server 綁 `127.0.0.1`）。這是刻意的：
你的對話與金鑰不應該因為連到咖啡廳 wifi 就暴露給同一個網路上的人。

要讓自己的手機連進來，建議用 [Tailscale](https://tailscale.com/)（把你的裝置組成一個私有網路）：

1. 電腦與手機都裝 Tailscale 並登入同一個帳號
2. 啟動時設 `HOST=0.0.0.0`
3. 手機開 `http://<電腦的 Tailscale IP>:8520`

> ⚠️ 設了 `HOST=0.0.0.0` 之後，**同一個區域網路上的人也連得到**。
> 在公共 wifi 上請不要這樣開。

---

## 開發

```bash
corepack enable
pnpm install
pnpm dev          # 前端 18520 ← 開這個
pnpm dev:server   # 後端 18521（前端會 proxy 過去）
pnpm verify       # 十三道閘門：build／test／lint／selftest／boundaries／no-hex／
                  # file-size／screens／back／no-eval／draft／guides／toast
pnpm package      # 打包成 dist-zip/vellum-vX.Y.Z.zip
pnpm app:dev      # 用 Electron 殼跑起來（桌面版）
pnpm app:build    # 出 .dmg／.exe，產物在 dist-app/
```

`pnpm verify` 是宣稱「改好了」的唯一收據。CI 每次 push 都會跑同一組。

> 🔴 **dev 是 18520／18521，正式版是 8520 —— 刻意錯開的。**
> 在此之前 dev 前端也用 8520，而桌面版預設也要綁 8520 ⇒ 兩邊互撞：
> 桌面版綁不上 port 就死掉，**而它的視窗載入的是 dev server 的畫面** ——
> 看起來是成功了，點幾頁才閃退。兩個 bug 互相掩護，找了很久。

> ⚠️ **`pnpm verify` 只在 macOS／Linux 跑得起來。**
> `gate:selftest` 是 POSIX shell 迴圈、`dev:server` 用行內環境變數 —— 兩者在 Windows 的 cmd 上都會炸。
> Windows CI **只跑冒煙測試**（解壓 zip → 啟動 → 首頁 → 建角色 → 重啟 → 資料還在）。
> 這是刻意的邊界，不是漏掉。

## 發版

```bash
# 1. 改 package.json 的 version
# 2.
git tag v0.1.0 && git push origin v0.1.0
```

GitHub Actions 會 build、打包成一個 zip，並開一個 Release 把 zip 掛上去。
app 裡的更新檢查看的就是這個 Release 的 tag。

> 🔴 **只有一個 zip，不分平台。** 裡面是純 JS（相依全 bundle 進 `dist-server/index.mjs`，
> 零 native module），Mac 與 Windows 的啟動檔都在同一包裡。
