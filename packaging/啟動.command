#!/bin/bash
# Vellum 啟動檔（macOS）—— 在 Finder 裡雙擊即可。
#
# 🔴 第一件事一定是 cd 到這個檔案自己所在的目錄。
#    雙擊時 cwd 是家目錄，不是這裡 ⇒ data/ 會被建到 ~/data，
#    使用者的角色卡與對話就跑到別的地方去了（而畫面看起來只是「還沒有好友」）。
cd "$(dirname "$0")" || exit 1

echo "Vellum —— 啟動中…"
echo ""

if ! command -v node > /dev/null 2>&1; then
  echo "找不到 Node.js。"
  echo ""
  echo "請到 https://nodejs.org 下載並安裝 LTS 版（左邊那顆綠色按鈕），"
  echo "安裝完關掉這個視窗，再重新雙擊一次這個檔案。"
  echo ""
  read -r -p "按 Enter 關閉…"
  exit 1
fi

# 🔴 20.19 是下限，不是 20。20.0–20.18 沒有 ESM 自動偵測，跑起來會是一句
#    看不懂的 "Cannot use import statement outside a module"。
MAJOR=$(node -p "process.versions.node.split('.')[0]")
MINOR=$(node -p "process.versions.node.split('.')[1]")
if [ "$MAJOR" -lt 20 ] || { [ "$MAJOR" -eq 20 ] && [ "$MINOR" -lt 19 ]; }; then
  echo "你的 Node.js 是 v$(node -p "process.versions.node")，版本太舊。"
  echo ""
  echo "請到 https://nodejs.org 下載 LTS 版（需要 20.19 以上），"
  echo "安裝完關掉這個視窗，再重新雙擊一次。"
  echo ""
  read -r -p "按 Enter 關閉…"
  exit 1
fi

# 🔴 NODE_ENV 沒設的話前端完全不掛，打開只會看到 API 的 JSON。
export NODE_ENV=production
# 🔴 這條路是使用者雙擊進來的 ⇒ 幫他把瀏覽器打開才對（dev 預設是關的）。
export VELLUM_OPEN=1

echo "要停止 Vellum，直接關掉這個視窗就可以。"
echo ""
node dist-server/index.mjs

echo ""
read -r -p "Vellum 已停止。按 Enter 關閉…"
