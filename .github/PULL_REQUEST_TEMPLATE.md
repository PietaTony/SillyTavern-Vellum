## 摘要

<!-- 一句話：這 PR 解決什麼？可觀察的結束狀態是什麼？ -->

## 起因

<!-- 可選。若像 #27 那樣是修規則打架或踩坑，寫清楚「為什麼非改不可」。 -->

## 做了什麼

<!-- bullet 列出主要變更；安全／持久化／新 route 請點名檔案 -->

## ⚠️ 老實說

<!-- 已知限制、Phase 2、這次**沒**解決什麼。沒有就寫「無」。 -->

## 驗收

- [ ] `pnpm verify` 全綠（貼真實輸出尾端，不要只寫「我跑過了」）
- [ ] 新 route 已進 `design/screens.json`（若有 UI）
- [ ] 新持久化檔有六題檔頭 + README 安全段（若適用）
- [ ] `pnpm gate:pr-ready --diff origin/staging` 綠（開 PR 前）

## pnpm verify

```
<!-- 貼 verify 最後幾行：tests 數、gate PASS -->
```
