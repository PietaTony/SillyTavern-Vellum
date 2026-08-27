# vendor —— 內嵌進卡片沙箱的第三方函式庫

這裡的三支會被 `src/features/cardscripts/runtime/vendorScripts.ts` 用 `?raw` 讀成字串、
**整份內嵌進每個卡片 iframe 的 `srcdoc`**。使用者跑 Vellum 時**不會有任何外連**。

| 檔 | 版本 | 來源 |
|---|---|---|
| `lodash.min.js` | 4.17.21 | npm `lodash@4.17.21` |
| `jquery.min.js` | 3.7.1 | npm `jquery@3.7.1` |
| `js-yaml.min.js` | 4.1.0 | npm `js-yaml@4.1.0` |

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
cp node_modules/lodash/lodash.min.js      vendor/lodash.min.js
cp node_modules/jquery/dist/jquery.min.js vendor/jquery.min.js
cp node_modules/js-yaml/dist/js-yaml.min.js vendor/js-yaml.min.js
pnpm verify   # 內嵌大小的下限有測試守著
```
