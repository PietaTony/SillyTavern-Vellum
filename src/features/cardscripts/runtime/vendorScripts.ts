import jquery from '../../../../vendor/jquery.min.js?raw';
import jsyaml from '../../../../vendor/js-yaml.min.js?raw';
import lodash from '../../../../vendor/lodash.min.js?raw';

/**
 * 卡片會用到的第三方全域，**整份內嵌進 srcdoc，不去外面抓**。
 *
 * 🔴 **原本是三支 CDN `<script src>`，而且沒鎖版本**：
 * `https://testingcf.jsdelivr.net/npm/lodash/lodash.min.js` —— 沒有 `@4.17.21`
 * ⇒ jsdelivr 給的是**最新版**。lodash 一發新版，卡片下次跑就換了引擎，而我們測不到。
 * 而且是**測試 CDN**（`testingcf.`）不是主 CDN。
 *
 * 🔴 **判準是我們自己在 `toastr` 那條寫下的**：「少一支 CDN、少一條外連」。
 * 同一條套到這三支就是全部落地。落地之後：
 *   · **零外連** ⇒ `VENDOR_HOSTS` 空 ⇒ 同意視窗少一項要跟使用者解釋的風險
 *   · **斷網也跑得起來**（Vellum 本來就是自己機器上的東西）
 *   · 版本鎖在 `pnpm-lock.yaml`，還附完整性雜湊
 *
 * 🔴 **為什麼是內嵌不是「放我們自己的網址」**：沙箱 iframe 是 opaque origin，
 * 而 `policyOf()` 只放行 `https://<host>` —— 我們在區網／Tailscale 上是 **http**，
 * 那條 CSP 永遠不會match。內嵌完全不經過 CSP，也不多一次請求。
 * ⚠️ 代價是每個 frame 的 srcdoc 多約 200 KB（lodash 72＋jQuery 88＋js-yaml 40）。
 *
 * ⚠️ **檔案 commit 在 `vendor/`**，對應的 npm 套件仍列在 `devDependencies` ——
 * 那是版本與完整性雜湊的正本，也是更新時的來源（`vendor/README.md` 有指令）。
 * 落檔而不是從 `node_modules` 讀的理由：`js-yaml` 的 `exports` 擋掉深層路徑。
 */
const inline = (js: string): string =>
  // 🔴 `</script` 一定要拆開：函式庫內容裡只要出現一次，我們這個標籤就提早關掉，
  // 後面整份 HTML 全被當成腳本內容。（`seedGlobal()` 是同一條教訓的另一半。）
  `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`;

export const VENDOR_INLINE = [lodash, jquery, jsyaml].map(inline).join('');
