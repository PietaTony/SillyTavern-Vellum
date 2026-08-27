# vendor —— 內嵌進卡片沙箱的第三方函式庫

這裡的三支會被 `src/features/cardscripts/runtime/vendorScripts.ts` 用 `?raw` 讀成字串、
**整份內嵌進每個卡片 iframe 的 `srcdoc`**。使用者跑 Vellum 時**不會有任何外連**。

| 檔 | 版本 | 來源 |
|---|---|---|
| `lodash.min.js` | 4.18.1 | npm `lodash@4.18.1` |
| `jquery.min.js` | 3.7.1 | npm `jquery@3.7.1` |
| `js-yaml.min.js` | 4.3.1 | npm `js-yaml@4.3.1` |

## 🔴 鎖版本要配「定期升」，兩件事是一組的

2026-08-27 剛鎖版本的那一天就踩到：初版釘的是 `lodash@4.17.21` 與 `js-yaml@4.1.0`，
而這兩個版本各自帶 **HIGH CVE**——lodash 的 `_.template` code injection
（修好的是 `>=4.18.0`）、js-yaml 的兩支二次方 CPU 消耗（修好的是 `>=4.3.1`）。

🔴 **鎖之前反而沒這個問題**：那時是 `jsdelivr/npm/lodash/lodash.min.js`（沒帶版號 ⇒ 給最新），
拿到的是已修的 4.18.x。**鎖版本換到了可重現性，代價是把當下那一版的漏洞一起釘住。**

⚠️ 而且這三支是被 `?raw` 整份塞進**卡片 iframe** 的，
卡片腳本是陌生人寫的不可信任 code ⇒ **同一個 CVE 在這裡比在後端嚴重。**

⇒ **每次發版前 `pnpm audit` 都要看這三支**（`.claude/skills/release` 關 4 已寫進去）。
`package.json` 另有 `pnpm.overrides.lodash`，是為了連 `electron-builder` 的傳遞相依一起壓掉——
那條只在 build 期，不散布，但留著會讓閘門一直紅，而永遠紅的閘門等於沒有閘門。

## ⚠️ `js-yaml` 4.3.1 的壓縮檔不再自帶授權標頭

4.1.0 的第一行是 `/*! js-yaml 4.1.0 ... @license MIT */`，**4.3.1 沒有了**（實測 0 個命中）。
lodash 與 jQuery 仍然自帶。⇒ js-yaml 的授權文字**只存在於 `THIRD-PARTY-NOTICES.md`**，
那份是跟著散布的，合規靠它。**不要以為壓縮檔自己會帶。**

🔴 **在此之前這三支是 CDN `<script src>`，而且沒鎖版本**
（`https://testingcf.jsdelivr.net/npm/lodash/lodash.min.js` —— 沒有 `@4.17.21`
⇒ jsdelivr 給的是最新版）。上游一發新版，卡片下次跑就換了引擎，而我們測不到。

## 為什麼是 commit 進來，不是 build 時從 node_modules 讀

`js-yaml` 的 `exports` 欄位**擋掉深層路徑** ⇒ `js-yaml/dist/js-yaml.min.js?raw` 解析不到。
三支各用一種讀法會讓下一個人看不懂，所以統一落檔。

三支對應的 npm 套件仍列在 `devDependencies`：那是**版本與完整性雜湊的正本**
（`pnpm-lock.yaml` 有 integrity），也是更新時的來源。

## 要更新版本

```bash
pnpm add -D -E lodash@<新版> jquery@<新版> js-yaml@<新版>
# 🔴 lodash 另有 pnpm.overrides 也要一起改，否則傳遞相依仍是舊版
cp node_modules/lodash/lodash.min.js      vendor/lodash.min.js
cp node_modules/jquery/dist/jquery.min.js vendor/jquery.min.js
cp node_modules/js-yaml/dist/js-yaml.min.js vendor/js-yaml.min.js
pnpm verify   # 內嵌大小的下限有測試守著
```
