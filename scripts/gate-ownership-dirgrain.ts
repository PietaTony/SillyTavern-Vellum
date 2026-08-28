/**
 * 這支在守什麼：`gate-ownership.ts` 的「單一 owner 目錄」放寬——治
 * `INBOX/20260828-ownership-extract-deadlock.md` 那個死結。獨立成檔是因為
 * `gate-ownership.ts` 已經 1600+ 行；這是 `scripts/**`（P1 的 glob），抽檔不會變
 * 孤兒（不像 `server/lib/` 那種逐檔具名的目錄，見 CLAUDE.md §5、`platform.md` §1）。
 *
 * 問題：`server/lib/` `server/routes/` `server/services/` `src/app/screens/` 這幾個
 * 目錄的認領方式是「逐檔具名」，不是 glob——一個 agent 要新增一支檔案，若沒有在自己
 * 的 `.claude/agents/<name>.md` §1 裡先加上檔名，`gate:ownership` 就判孤兒。這本身是
 * 對的（防止悄悄新增一支沒人管的檔），但 150 行上限逼人抽檔時，同一輪 PR 裡新抽出來
 * 的檔案就是孤兒——即使那個目錄事實上只有一個 owner，加檔完全不會引發「這支到底歸誰」
 * 的疑問。
 *
 * 判準（Peter 2026-08-28 裁定，票裡列的方向 (a)）：只放寬「這個目錄底下**目前所有
 * 具名認領都屬於同一個 agent**」的情況——那個 agent 在同一個目錄新增的檔，視同已
 * 認領，不必等下一輪 PR 才補登記。**共用目錄（2 個以上 agent 在同一個目錄都有具名
 * 檔，例如 `server/services/`）維持嚴格**，新檔依然是孤兒，必須先具名登記才過。
 *
 * 🔴 別把「誰擁有什麼」弄成先到先贏——這是這張票原文點名最容易踩的坑：
 *   - 判準是「這個目錄現在的具名認領集合裡有幾個**不同**的 agent」，不是「隨便找到
 *     一個符合的 agent 就用它」。`Map`／`Set` 的走訪順序不影響結果：2 個以上不同
 *     agent 一律不放行，不會因為誰先被掃到就被指定成唯一 owner。
 *   - 也不因為某個 agent 在那個目錄具名的檔案數量比較多就贏——`server/services/`
 *     底下 chat-core 具名了 8 支、card-scripts 只有 1 支（`applyVarUpdate.ts`），
 *     但只要「不同 agent 數」≥2，這個目錄整個不放行，跟數量無關，也不是「多數決」。
 *   - 額外防呆：目錄底下只要有任何路徑命中 `AGENTS.md` §2 的 X／Xg（沒人擁有）、
 *     或落在**別的** agent 的 glob 底下，也一律不放行——即使目前只有 1 個具名
 *     agent，這種目錄有第二套宣告機制同時在管，不是乾淨的單一 owner，貿然放行等於
 *     悄悄把 X／Xg 或別人 glob 的地盤讓給這一個 agent。
 *
 * 實測（2026-08-28，把 `own`——十一份 agent 定義檔目前的具名認領——照直屬目錄分組
 * 各數一次不同 agent 數）：`server/lib/` 11 個、`server/routes/` 10 個、
 * `server/services/` 8 個、`src/app/screens/` 4 個——**這四個踩過真實孤兒卡關的
 * 目錄全部是共用目錄，這輪放寬幫不到它們，維持嚴格是唯一誠實的答案**（見票 §3
 * 方向 (a)，以及本檔自己的 `--selftest` 用這四個目錄的真實資料做迴歸）。真正受益
 * 的是像 `src/app/routes/chat/`（chat-core 單一）、`src/app/routes/import/`
 * （characters 單一）、`src/app/routes/settings/providers/`（providers 單一）這類
 * 目錄，以及未來任何 agent 為了拆檔新建的專屬子目錄——例如把 `server/services/`
 * 底下自己的檔案搬進 `server/services/<own-subdir>/`，那個新子目錄一旦只有自己
 * 認領，之後在裡面加檔就不用每次先改 `.md`。
 *
 * 這支自己的 `--selftest` 只測純演算法（合成 fixture）——四個真實共用目錄
 * （`server/lib/` 等）維持嚴格、真實單一 owner 目錄有放行，這兩類迴歸放在
 * `gate-ownership.ts` 自己的 `--selftest` 裡（那邊已經有 `loadAgentClaims()`
 * 算好的 `real.own`，不在這裡重新實作一份簡化版解析——這支檔頭自己都在講
 * 「每加一條平行解析路徑都要重新問一次舊坑清單」，不應該自己先犯規）。
 *
 * 自證：pnpm exec tsx scripts/gate-ownership-dirgrain.ts --selftest
 */
export type OwnerMap = Map<string, string>;

/** path 的直屬目錄前綴（含結尾 `/`）——跟 `.claude/agents/*.md` 裡 DIR_BULLET 解析
 *  用的同一個粒度，不往上層祖先目錄推。根目錄具名檔（例如 `package.json`）沒有
 *  「目錄」可言，回傳空字串。 */
export function dirOf(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx + 1);
}

/**
 * 對 `own`（具名認領）裡的每個路徑照 `dirOf()` 分組，回傳「目錄 → 這個目錄底下
 * 出現過的所有不同 agent」。只看具名認領，不看掃描到的 `targets`——「這個目錄的
 * 認領長什麼樣」跟「掃到了什麼實體檔案」是兩件事，先分開算，`singleOwnerDirs()`
 * 才不會把兩者混在一起判斷。
 */
export function groupByDir(own: OwnerMap): Map<string, Set<string>> {
  const byDir = new Map<string, Set<string>>();
  for (const [path, agent] of own) {
    const dir = dirOf(path);
    if (!dir) continue; // 根目錄具名檔不参与目錄放寬
    const s = byDir.get(dir) ?? new Set<string>();
    s.add(agent);
    byDir.set(dir, s);
  }
  return byDir;
}

/**
 * 回傳「只有一個 agent 的目錄 → 那個 agent」。這是唯一放行的集合；不在裡面的目錄
 * （目前沒有任何具名檔、或 2 個以上不同 agent）新檔一律照舊判孤兒，不會被這支放行。
 *
 * 三個條件同時要過，任何一個沒過就整個目錄排除在放寬之外：
 *   1. 目錄底下所有 `own` 認領只屬於同一個 agent（「先到先贏」的坑——見檔頭）。
 *   2. 目錄底下沒有任何路徑命中 `X`（`AGENTS.md` §2 具名無主檔）。
 *   3. 目錄底下沒有任何路徑命中 `Xg`（§2 無主 glob）、或落在別的 agent 的 glob
 *      底下（跟自己撞的話已經是另一種紅燈，不在這支的職責內；這裡只防「用這支的
 *      放寬去侵蝕別人地盤」）。
 */
export function singleOwnerDirs(
  own: OwnerMap,
  X: Set<string>,
  Xg: Set<string>,
  globs: Map<string, string>,
): Map<string, string> {
  const byDir = groupByDir(own);
  const result = new Map<string, string>();

  for (const [dir, agents] of byDir) {
    if (agents.size !== 1) continue; // 坑：2 個以上一律不放行，不因走訪順序或數量而異
    const soleAgent = [...agents][0] ?? '';

    let poisoned = false;
    for (const x of X) {
      if (dirOf(x) === dir) {
        poisoned = true;
        break;
      }
    }
    if (!poisoned) {
      const prefixes = [...Xg, ...globs.keys()];
      for (const g of prefixes) {
        if (globs.get(g) === soleAgent) continue; // 自己的 glob 不算「別人的地盤」
        const gp = g.slice(0, -2);
        if (dir.startsWith(gp) || gp.startsWith(dir)) {
          poisoned = true;
          break;
        }
      }
    }
    if (poisoned) continue;

    result.set(dir, soleAgent);
  }
  return result;
}

// 🔴 這支被 `gate-ownership.ts` `import`（不是獨立跑）——`process.argv` 在那個情境
// 下**也帶著 `--selftest`**（呼叫端是 `tsx scripts/gate-ownership.ts --selftest`）。
// 舊寫法只看 `process.argv.includes('--selftest')`，`import` 一發生就會在
// `gate-ownership.ts` 自己的 dispatcher 跑到之前，搶先呼叫這支的 `runSelftest()`
// 並 `process.exit()`——`gate-ownership.ts` 那 70 幾條斷言（含這輪新增、真正驗證
// `covered()`／`decide()` 有沒有把這支接進主流程的那幾條）整段從沒被執行過，回報的
// 卻是**這支自己**那 5 條的 PASS，看起來像「70 幾條全綠」。跟這支檔頭引的
// `gate-ownership.ts` 歷史坑（把 `walk()` 遞迴砍掉、`--selftest` 照樣 PASS）是同一
// 種病：入口判斷太寬鬆，`import` 被誤當成「使用者在跑我」。
// 用 Node ESM「這支是不是被當成程式進入點執行」的標準寫法收斂：只有
// `import.meta.url` 等於「這次 `tsx` 命令實際跑的那支檔案」時才算——`import` 進另一
// 支檔案時 `process.argv[1]` 是另一支檔案的路徑，這裡恆為 false，不會搶跑。
const isEntryPoint = import.meta.url === `file://${process.argv[1]}`;
if (isEntryPoint && process.argv.includes('--selftest')) {
  runSelftest();
}

function runSelftest(): void {
  // 案例1：單一 owner 目錄——只有 agent 'a' 具名，判準要抓到並回傳 'a'。
  const own1: OwnerMap = new Map([
    ['x/known1.ts', 'a'],
    ['x/known2.ts', 'a'],
  ]);
  const dirs1 = singleOwnerDirs(own1, new Set(), new Set(), new Map());

  // 案例2（安全欄杆，票裡的「別人」）：同一個目錄底下有 2 個不同 agent 具名——
  // 不放行，不管走訪順序、不管誰的檔案數量比較多。
  const own2: OwnerMap = new Map([
    ['y/known1.ts', 'a'],
    ['y/known2.ts', 'a'],
    ['y/known3.ts', 'a'],
    ['y/known4.ts', 'b'], // 只有 1 支，數量上是少數，但一樣要否決整個目錄
  ]);
  const dirs2 = singleOwnerDirs(own2, new Set(), new Set(), new Map());

  // 案例3：目錄底下有 1 個具名 agent，但同一個目錄還命中 X（AGENTS.md §2 具名無主
  // 檔）——防呆要擋下來，不能把 X 的地盤讓給那個 agent。
  const own3: OwnerMap = new Map([['z/known.ts', 'a']]);
  const dirs3 = singleOwnerDirs(own3, new Set(['z/nobody.ts']), new Set(), new Map());

  // 案例4：目錄底下有 1 個具名 agent，但同一個目錄落在**別人**的 glob 底下——
  // 防呆要擋下來。
  const own4: OwnerMap = new Map([['w/known.ts', 'a']]);
  const dirs4 = singleOwnerDirs(own4, new Set(), new Set(), new Map([['w/**', 'b']]));

  // 案例4 對照組：目錄底下有 1 個具名 agent，同一個目錄落在**自己**的 glob 底下——
  // 不該被自己的 glob 誤判成「別人的地盤」。
  const own4b: OwnerMap = new Map([['v/known.ts', 'a']]);
  const dirs4b = singleOwnerDirs(own4b, new Set(), new Set(), new Map([['v/**', 'a']]));

  const cases: [string, boolean][] = [
    ['案例1：單一 owner 目錄被抓到、agent 正確', dirs1.get('x/') === 'a'],
    ['案例2（安全欄杆）：2 個 agent 的目錄不放行，不管數量誰多', !dirs2.has('y/')],
    ['案例3：目錄命中 X（無主檔）→ 不放行', !dirs3.has('z/')],
    ['案例4：目錄落在別人的 glob 底下 → 不放行', !dirs4.has('w/')],
    ['案例4對照組：目錄落在自己的 glob 底下 → 不誤判', dirs4b.get('v/') === 'a'],
  ];
  const bad = cases.filter(([, ok]) => !ok);
  for (const [name] of bad) console.error(`  selftest FAIL：${name}`);
  console.log(
    bad.length
      ? `selftest FAIL（${bad.length} 條，共 ${cases.length} 條）`
      : `selftest PASS（${cases.length} 條純演算法：單一owner放行、先到先贏安全欄杆、` +
          `X／別人glob防呆、自己glob不誤傷——四個真實目錄的迴歸在 gate-ownership.ts ` +
          `自己的 --selftest 裡，見那邊的 real.own）`,
  );
  process.exit(bad.length ? 1 : 0);
}
