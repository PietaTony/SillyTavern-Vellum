# Vellum

本機單人的 LLM 角色扮演與長對話 app。**你的角色卡、對話、金鑰都留在你自己的電腦上。**

SillyTavern 的 fork —— 功能一樣，UI／UX 大改。授權 AGPL-3.0。

---

## 安裝（三種平台同一行）

需要先裝 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（Windows／macOS／Linux 都有）。

```bash
mkdir vellum && cd vellum
curl -L -o docker-compose.yml https://raw.githubusercontent.com/PietaTony/SillyTavern-Vellum/main/docker-compose.yml
docker compose up -d
```

打開 **<http://localhost:8787>** 就可以用了。第一次會帶你設定 API 金鑰。

> 🔴 **`./data` 這個資料夾就是你的全部身家**（角色卡、對話、金鑰）。
> 它跟 `docker-compose.yml` 放在一起，備份就是複製這個資料夾。

<details>
<summary>不想用 Docker？（需要 Node 24 與 pnpm）</summary>

```bash
git clone https://github.com/PietaTony/SillyTavern-Vellum.git
cd SillyTavern-Vellum
pnpm install
pnpm start
```
</details>

---

## 更新

app 裡有新版時會直接告訴你。要更新就跑：

```bash
docker compose pull && docker compose up -d
```

**資料不會動到** —— 它在 `./data`，不在容器裡。

> 🔴 我們**不做自動更新**。理由是同類專案（Open WebUI）的實際教訓：
> 版本一旦帶破壞性變更或資料遷移，自動更新會在你不知情的時候弄壞你的東西。
> ⇒ **通知你，由你決定什麼時候更新。**

---

## 從手機或平板連進來

預設**只有這台電腦連得到**（`docker-compose.yml` 綁 `127.0.0.1`）。這是刻意的：
你的對話與金鑰不應該因為連到咖啡廳 wifi 就暴露給同一個網路上的人。

要讓自己的手機連進來，建議用 [Tailscale](https://tailscale.com/)（把你的裝置組成一個私有網路）：

1. 電腦與手機都裝 Tailscale 並登入同一個帳號
2. 把 `docker-compose.yml` 的 `"127.0.0.1:8787:8787"` 改成 `"8787:8787"`
3. `docker compose up -d`
4. 手機開 `http://<電腦的 Tailscale IP>:8787`

> ⚠️ 改成 `"8787:8787"` 之後，**同一個區域網路上的人也連得到**。
> 在公共 wifi 上請不要這樣開。

---

## 開發

```bash
pnpm install
pnpm dev          # 前端 5173
pnpm dev:server   # 後端 8787
pnpm verify       # 九道閘門：typecheck／test／lint／selftest／boundaries／no-hex／file-size／screens／back
```

`pnpm verify` 是宣稱「改好了」的唯一收據。CI 每次 push 都會跑同一組。

## 發版

```bash
# 1. 改 package.json 的 version
# 2.
git tag v0.1.0 && git push origin v0.1.0
```

GitHub Actions 會建 amd64／arm64 兩種 image 推到 ghcr.io，並開一個 Release。
app 裡的更新檢查看的就是這個 Release 的 tag。
