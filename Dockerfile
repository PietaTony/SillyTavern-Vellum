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

# 🔴 角色卡、對話、金鑰都在這裡。**沒有掛 volume 就會隨容器一起消失。**
VOLUME /app/data

EXPOSE 8520
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8520)+'/api/version').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist-server/index.js"]
