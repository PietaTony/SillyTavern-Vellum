# syntax=docker/dockerfile:1

# ── 建置階段 ────────────────────────────────────────────────
# 🔴 build 需要 devDependencies（vite／tsc／esbuild），runtime 不需要 ⇒ 分兩段。
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable

# 先只複製相依清單：改 code 不會讓 pnpm install 的快取失效
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# 前端 → dist/，後端 → dist-server/index.js（純 JS，runtime 不需要 tsx）
RUN pnpm build

# ── 執行階段 ────────────────────────────────────────────────
FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
# 🔴 容器內一定要綁 0.0.0.0，綁 127.0.0.1 的話 -p 對映進來會連不到。
#    這不等於「對外開放」—— 對外開放與否由 docker 的 -p 決定。
ENV HOST=0.0.0.0
ENV PORT=8787

RUN corepack enable
COPY package.json pnpm-lock.yaml ./
# 只裝正式相依。`--ignore-scripts` 擋掉套件的安裝腳本（供應鏈紀律）
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

# 🔴 角色卡、對話、金鑰都在這裡。**沒有掛 volume 就會隨容器一起消失。**
VOLUME /app/data

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/version').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist-server/index.js"]
