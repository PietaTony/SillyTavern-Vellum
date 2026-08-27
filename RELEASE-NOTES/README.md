# RELEASE-NOTES —— 給使用者看的更新內容

> 🔴 **這裡的文字會原封不動出現在 GitHub Release 頁面，以及 app 內的「有新版」畫面上。**
> 讀者是**使用者**，不是我們。不要出現 🔴、GAP-n、內部推理、檔案路徑、commit hash。

## 怎麼用

**`next.md` 是唯一的正本。** 推 `staging` 之前把下一版的內容寫進去。
CD（`.github/workflows/cd.yml` 的 `release` job）會讀它當 Release 的內文。

**檔案不存在或內容是空的 ⇒ CD 直接紅**，不會靜靜發一個沒有說明的版本。

## 為什麼不是 `v0.2.2.md` 這種檔名

版號的 patch 是 `github.run_number`（見 `cd.yml` 的 `version` job），
而 **run_number 連失敗的 run 也會遞增** ⇒ 推之前沒有人知道這一版會是幾號。
檔名綁版號在機制上做不到，所以正本用固定檔名 `next.md`。

歷史版本的內容留在 GitHub Release 頁面上，不在這個 repo 裡重複一份。

## 寫法

- 開頭一句話講**這一版對使用者有什麼不同**。
- 用「你可以…」「修好了…」，不要用「重構了…」「移除了…」。
- 沒有使用者看得見的變化時，就老實寫「這一版只有內部調整」。
