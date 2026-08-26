@echo off
chcp 65001 > nul
rem Vellum 啟動檔（Windows）—— 在檔案總管裡雙擊即可。
rem
rem 🔴 第一件事一定是 cd 到這個檔案自己所在的目錄（/d 連磁碟機也切）。
rem    雙擊時 cwd 不一定是這裡 ⇒ data\ 會被建到別的地方，
rem    使用者的角色卡與對話就跑掉了（而畫面看起來只是「還沒有好友」）。
cd /d "%~dp0"

echo Vellum —— 啟動中...
echo.

where node > nul 2>&1
if errorlevel 1 (
  echo 找不到 Node.js。
  echo.
  echo 請到 https://nodejs.org 下載並安裝 LTS 版（左邊那顆綠色按鈕），
  echo 安裝完關掉這個視窗，再重新雙擊一次這個檔案。
  echo.
  pause
  exit /b 1
)

rem 🔴 20.19 是下限，不是 20。20.0–20.18 沒有 ESM 自動偵測，
rem    跑起來會是一句看不懂的 "Cannot use import statement outside a module"。
rem ⚠️ 兩個 for 都要在 if 之外先跑完：cmd 會在進入 if 區塊時就把 %VAR% 展開，
rem    在區塊內才 set 的變數展開出來是空的（除非開 delayed expansion）。
for /f "delims=" %%v in ('node -p "process.versions.node"') do set NODEVER=%%v
for /f "delims=" %%v in ('node -p "const [a,b]=process.versions.node.split('.').map(Number); (a>20||(a===20&&b>=19))?'ok':'old'"') do set NODEOK=%%v
if not "%NODEOK%"=="ok" (
  echo 你的 Node.js 是 v%NODEVER%，版本太舊。
  echo.
  echo 請到 https://nodejs.org 下載 LTS 版（需要 20.19 以上），
  echo 安裝完關掉這個視窗，再重新雙擊一次。
  echo.
  pause
  exit /b 1
)

rem 🔴 NODE_ENV 沒設的話前端完全不掛，打開只會看到 API 的 JSON。
set NODE_ENV=production
rem 🔴 這條路是使用者雙擊進來的 ⇒ 幫他把瀏覽器打開才對（dev 預設是關的）。
set VELLUM_OPEN=1

echo 要停止 Vellum，直接關掉這個視窗就可以。
echo.
node dist-server\index.mjs

echo.
pause
