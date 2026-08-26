# syntax=docker/dockerfile:1

# ── 建置階段 ────────────────────────────────────────────────
# 🔴 build 需要 devDependencies（vite／tsc／esbuild），runtime 不需要 ⇒ 分兩段。
# 🔴 **用 slim（Debian／glibc）不是 alpine（musl）**：`.npmrc` 釘死 `use-node-version=24.15.0`，
#    pnpm 會去抓官方 Node 二進位，而官方只出 glibc 版 ⇒ alpine 上會 ERR_PNPM_MUSL。
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable

# 先只複製相依清單：改 code 不會讓 pnpm install 的快取失效
COPY package.json pnpm-lock.yaml ./
# 🔴 `--config.minimumReleaseAge=0`：pnpm 10 預設拒裝 24 小時內剛發佈的套件（供應鏈防護）。
# 這裡關掉的理由是**這一步不做解析**：`--frozen-lockfile` 裝的是已經在本機審過的同一份
# lockfile。防護真正該生效的地方是「有人新增相依」的當下，那在本機，本機那道沒有動。
# 不關的話：只要 lockfile 裡有任何一個套件是昨天發的，image 就建不起來。
RUN pnpm install --frozen-lockfile --config.minimumReleaseAge=0

COPY . .
# 前端 → dist/，後端 → dist-server/index.js（純 JS，runtime 不需要 tsx）
# 🔴 `pnpm build` 的順序是 **vite build → tsc → build:server**，不能對調。
#    `src/app/routeTree.gen.ts` 由 vite 的 `@tanstack/router-plugin` 在 build 時產生，
#    而且被 gitignore ⇒ 全新 checkout（這裡就是）根本沒有它。
#    tsc 排前面的話會在 vite 有機會產生它之前先炸（`Cannot find module './routeTree.gen'`）。
#    實測：`git archive HEAD` 到乾淨環境跑 tsc 必炸 11 個錯；換順序後同一份 commit 全過。
RUN pnpm build

# ── 執行階段 ────────────────────────────────────────────────
FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production
# 🔴 容器內一定要綁 0.0.0.0，綁 127.0.0.1 的話 -p 對映進來會連不到。
#    這不等於「對外開放」—— 對外開放與否由 docker 的 -p 決定。
ENV HOST=0.0.0.0
ENV PORT=8520

RUN corepack enable
COPY package.json pnpm-lock.yaml ./
# 只裝正式相依。`--ignore-scripts` 擋掉套件的安裝腳本（供應鏈紀律）
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --config.minimumReleaseAge=0

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
# 🔴 內建背景（23 張，11 MB）。**不 COPY 的話容器裡的 `seedBackgrounds()` 會靜靜地
# 複製 0 張** —— 畫面看起來就是「背景清單是空的」，而且不會有任何錯誤訊息。
COPY --from=build /app/default ./default

# 🔴 角色卡、對話、金鑰都在這裡。**沒有掛 volume 就會隨容器一起消失。**
VOLUME /app/data

# 🔴 **不要用 root 跑。** node 官方 image 內建一個 uid 1000 的 `node` 使用者。
# 容器逃逸不是理論問題，用非特權使用者可以把半徑縮小。
# `data/` 要給它寫入權（bind mount 的擁有者是主機端，這行處理容器內建立的情況）。
RUN chown -R node:node /app
USER node

EXPOSE 8520
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8520)+'/api/version').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist-server/index.js"]
