/**
 * x64 那包 zip 預設檔名是 `Vellum-<版本>-mac.zip` —— 名字完全看不出它是 Intel 版。
 * M 系列使用者很容易下載到它。
 *
 * 🔴 electron-builder 的 `artifactName` macro **沒有條件語法**：同一個 pattern 套用在
 * `mac.target` 底下的 arm64／x64 兩個 arch，沒辦法只讓 x64 帶上「intel」字樣、arm64
 * 維持原樣（見 `app-builder-lib/out/util/macroExpander.js`：`${arch}` 只會被換成
 * `Arch[arch]` 的原始名字，不支援 per-arch 的字串替換）。
 *
 * 🔴 **這支是獨立的 post-build 腳本，不是 electron-builder 的 hook。**
 * 一開始用 `afterAllArtifactBuild` hook 實作過，**實測是錯的**：這個 hook 在
 * `packager.build()` resolve 之後就跑，但 `latest-mac.yml` 是在那之後、
 * `publishManager.awaitTasks()` 裡才寫出來的（`app-builder-lib/out/index.js`：
 * `afterAllArtifactBuild` 呼叫完才進 `executeFinally` 分支去 `awaitTasks()`）。
 * 用 log 量到的：hook 跑的當下 `fs.existsSync(latest-mac.yml)` 是 `false`。
 * ⇒ 改成 `pnpm app:build` 跑完「整個」`electron-builder` CLI 行程之後再串接這支，
 * 那時候 feed 檔保證已經寫好（`writeUpdateInfoFiles` 是 CLI process exit 前的最後動作）。
 *
 * 🔴 只搬檔名，不動檔案內容：sha512／size 不必重算。blockmap 是 zip 檔名 + `.blockmap`，
 * 也要一起改名，否則差量更新（differential download）會抓到 404 而整個回退成全量下載
 * ——不是致命錯，但值得順手做對。
 *
 * 在非 mac 的 build（Windows／Linux）上，`latest-mac.yml` 根本不存在，這支直接跳過
 * （不是錯誤，`app:build` 三個平台都會呼叫到同一支）。
 */
const fs = require('node:fs');
const path = require('node:path');

const OUT_DIR = path.join(__dirname, '..', 'dist-app');
const FEED_FILE = 'latest-mac.yml';

function main() {
  const feedPath = path.join(OUT_DIR, FEED_FILE);
  if (!fs.existsSync(feedPath)) {
    // 不是 mac build（或這次沒開自動更新 feed）—— 沒事做
    return;
  }

  const entries = fs.readdirSync(OUT_DIR);
  // x64 那包：檔名以 `-mac.zip` 結尾，但不是 arm64 那包，也還沒被改過名
  const oldZipName = entries.find(
    (name) =>
      /-mac\.zip$/.test(name) &&
      !name.includes('-arm64-mac.zip') &&
      !name.includes('-intel-mac.zip'),
  );
  if (oldZipName == null) {
    console.warn(`  ⚠️ [rename-mac-intel-zip] 在 ${OUT_DIR} 找不到要改名的 x64 mac zip，略過`);
    return;
  }
  const newZipName = oldZipName.replace(/-mac\.zip$/, '-intel-mac.zip');

  for (const suffix of ['', '.blockmap']) {
    const oldPath = path.join(OUT_DIR, oldZipName + suffix);
    const newPath = path.join(OUT_DIR, newZipName + suffix);
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(
        `  • [rename-mac-intel-zip] 改名 ${oldZipName}${suffix} → ${newZipName}${suffix}`,
      );
    }
  }

  // latest-mac.yml 裡 files[].url 與頂層 path 都是同一個字串出現兩次，直接文字取代
  const feedContent = fs.readFileSync(feedPath, 'utf8');
  const updatedFeed = feedContent.split(oldZipName).join(newZipName);
  if (updatedFeed === feedContent) {
    // 量測管道要能證明自己真的量到東西 —— feed 裡沒有舊檔名就是這支壞了，不能靜靜過
    throw new Error(
      `[rename-mac-intel-zip] ${feedPath} 裡沒有找到 ${oldZipName}，改名沒有生效到 feed`,
    );
  }
  fs.writeFileSync(feedPath, updatedFeed);
  console.log(`  • [rename-mac-intel-zip] ${FEED_FILE} 已更新為新檔名`);
}

main();
