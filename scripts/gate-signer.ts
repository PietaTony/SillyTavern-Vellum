/**
 * 這支在守什麼：`dist-app/**\/*.app`（電子簽出來的每個 .app，含巢狀 Helper.app）
 * 的簽章者，必須是 `electron-builder.yml` 裡寫死的那張個人 Developer ID 憑證——
 * 不是公司那張、不是 ad-hoc、不是別的任何身分。
 *
 * 為什麼：這裡有一個**真實存在、會靜默發生**的地雷，不是假設——
 * `scripts/after-pack.cjs` 對每個 build 都先做一次 ad-hoc 簽章（見該檔檔頭）；
 * `mac.identity` 的字串如果找不到對應憑證（憑證過期、被移除、打錯字），
 * `app-builder-lib` 的 `MacTargetHelper.findSigningIdentity` 只會 `reportError`（警告）
 * 然後把 identity 回傳 `null`——不會讓整個 build 失敗（讀 `node_modules/.../
 * mac/MacTargetHelper.js` 實測過）。結果就是：electron-builder 那一步真簽章沒發生，
 * `after-pack.cjs` 那次 ad-hoc 簽章變成**最終**簽章，`pnpm app:build` 照樣 exit 0，
 * 產物看起來完全正常——直到使用者的 Gatekeeper 用 `spctl` 一查，發現不是我們以為的
 * 那張憑證。這正是 GAP-98（撈到公司憑證）同一類「build 綠燈≠簽對人」的問題，
 * 只是觸發路徑換了一條。
 *
 * 🔴 **不進 `pnpm verify` 的主鏈。** `pnpm verify` 的 `build` 只有 `vite build +
 * tsc + esbuild`，從不呼叫 `electron-builder`，`dist-app/` 底下永遠不會有 `.app`——
 * 若把這支的**正向檢查**掛進 `verify`，等於每一次 `pnpm verify`（包含沒有 Mac、
 * 沒有這張付費憑證的人）都會撞到「掃到 0 個 .app」，只有兩條路：讓它永遠 exit(2) 卡住
 * 每個人的日常验证，或是把 0 個檔案當成 PASS——後者正是 `gate-file-size.ts` 檔頭
 * 記錄過的同一種假綠燈。⇒ 正向檢查只接在**真的會產出 .app 的那一步**：
 * `package.json` 的 `app:build`，緊接在 `electron-builder` 產出 `.app` 之後、
 * `rename-mac-intel-zip.cjs` 改名之前——擋在「這個 build 要拿去發」之前，不是
 * 發完才發現。`--selftest` 這一半則照常掛在 `pnpm gate:selftest`（`scripts/gate-*.ts`
 * 的既有迴圈），所以「這把尺量不量得到」這件事本身每次 `pnpm verify` 都會驗到，
 * 即使當下機器上沒有半個 .app。
 *
 * 非 macOS：正向檢查（`main()`）用 `process.platform !== 'darwin'` 判斷要不要跳過——
 * `mac:` 段落本來就不會在非 mac runner 上被 build，跟 `rename-mac-intel-zip.cjs`
 * 對非 mac build 的處理方式一致，這條沒有改（production 的 `mac-app` CI job 是
 * `macos-latest`，保證有完整 Xcode，這裡沒有「判斷騙人」的風險）。
 *
 * 🔴 **`--selftest` 是另一件事，2026-08-28 CI 紅過一次**：`gate:selftest` 對每個
 * `scripts/gate-*.ts` 都跑 `--selftest`，而 `gates` job 跑在 `ubuntu-latest`——
 * Linux 上根本沒有 `codesign`，selftest 裡真的呼叫 `codesign --sign -` 簽一個假執行檔
 * 那條斷言直接 `ENOENT` 炸掉整支。**修法不是把整支 selftest 包一層 try/catch 吞掉**
 * （那會變成「這幾條斷言在 Linux 上從來沒真的跑過，但訊息說 PASS」——跟
 * `gate-no-hex.ts` 檔頭記過的「守備範圍變 0 卻還 PASS」是同一種假綠燈）：
 * 純字串比對那 3 條、以及「spawn 這支腳本本身指向空目錄」那 1 條**完全不需要
 * `codesign`**（後者在 `findApps()` 掃到 0 個就 `exit(2)` 了，根本還沒叫到
 * `codesign`），這 4 條任何平台都要跑到；只有「真的 ad-hoc 簽一個檔案再驗」那 1 條
 * 需要 `codesign`，沒有就明確印出跳過、原因、跳過幾條，然後 exit(0)——跳過要出聲，
 * 不能靜默。
 *
 * 🔴 判斷「這台機器有沒有 `codesign`」不用 `process.platform`——那個判斷本身會騙人：
 * 一台 mac 但沒裝對的工具（理論上）一樣會被誤判成「有」。這裡改成真的 `spawnSync`
 * 探測一次：`spawnSync` 對找不到的指令**不會丟例外**，只會在回傳值的 `.error` 帶上
 * `ENOENT`，比起用 `execFileSync` 硬猜再包 try/catch 更誠實——量到的就是「這個指令
 * 到底能不能被叫動」本身，不是一個代理指標。**這個判斷只用在 selftest**：`main()`
 * 的平台判斷維持原樣不動（production 的 CI runner 保證有 Xcode，不是這次要修的問題，
 * 不順手擴大改動範圍）。
 *
 * 期望值不寫死在這支檔案裡，直接從 `electron-builder.yml` 的 `mac.identity` 讀，
 * 再補回 `codesign` 實際印出來的 `Developer ID Application:` 型別字首——
 * 減少「改了憑證只改一邊」的漂移風險。
 *
 * 自證：pnpm exec tsx scripts/gate-signer.ts --selftest
 *   ① 純字串比對：塞公司憑證的 Authority 行 → 紅；塞正確身分 → 綠；沒有 Authority 行（unsigned）→ 紅
 *   ② 真的呼叫一次 `codesign`（沒有就明確跳過並印出理由）：對一個剛 ad-hoc 簽章
 *      （`codesign --sign -`）的假執行檔跑這支真正的檢查函式——ad-hoc 正是
 *      `after-pack.cjs` 在憑證找不到時最終會留下的那個狀態，不是憑空捏造的情境，
 *      且完全離線、不用密碼、不用真憑證
 *   ③ 真的 spawn 這支腳本本身，指向一個空目錄 → 驗證 exit code 精確等於 2（不需要 codesign）
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const AUTHORITY_PREFIX = 'Authority=';

/** electron-builder.yml 的 `mac.identity` 只放拿掉型別字首後的 qualifier
 *（見該檔 mac.identity 上方註解：完整字首會被 electron-builder 拒絕）。
 *  `codesign -dv` 印出來的 Authority 一定帶著完整型別字首，這裡補回去。 */
function expectedAuthority(configPath: string): string {
  const text = readFileSync(configPath, 'utf8');
  const m = text.match(/^\s*identity:\s*"([^"]+)"/m);
  if (!m || !m[1]) {
    throw new Error(`讀不到 mac.identity —— ${configPath} 格式變了，這支尺要跟著改`);
  }
  return `Developer ID Application: ${m[1]}`;
}

function findApps(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name.endsWith('.app')) out.push(p);
    findApps(p, out); // 繼續往下走：Helper.app 藏在 Contents/Frameworks/ 底下
  }
  return out;
}

/** 這台機器實際叫不叫得動 `codesign`——用真的 spawn 探測一次，不用 `process.platform`
 *  猜（見檔頭：後者在「mac 但沒裝對工具」時會騙人）。`spawnSync` 對找不到的指令不會
 *  丟例外，只在回傳值的 `.error` 帶上 `ENOENT`，這裡只判斷「叫得動」，不管它自己的
 *  exit code（`--help` 對某些版本可能回非 0，那不影響「這個指令存在」這個問題）。 */
function hasCodesign(): boolean {
  const r = spawnSync('codesign', ['--help'], { stdio: 'ignore' });
  const err = r.error as NodeJS.ErrnoException | undefined;
  return !err || err.code !== 'ENOENT';
}

/** 對純文字（codesign -dv --verbose=4 的輸出）做 Authority 比對 —— 不牽涉 shelling out，
 *  給 fixture 測試用，也是 checkApp() 內部共用的判斷邏輯。 */
export function checkAuthorityText(
  codesignOutput: string,
  expected: string,
): { ok: boolean; found: string | null } {
  const line = codesignOutput.split('\n').find((l) => l.startsWith(AUTHORITY_PREFIX));
  const found = line ? line.slice(AUTHORITY_PREFIX.length) : null;
  return { ok: found === expected, found };
}

/** 對一個真的檔案（.app 或任何 Mach-O）跑一次真的 codesign，回傳判斷結果。
 *  🔴 **`codesign -dv` 幾乎所有東西都印在 stderr，不是 stdout**——
 *  `execFileSync` 在 exit code 0 時只回傳 stdout，會把 stderr 整段丟掉，
 *  量到的永遠是空字串（2026-08-28 對著真的簽好的 .app 實跑撞過這個坑：
 *  明明手動 `codesign -dv --verbose=4 X 2>&1` 看得到 `Authority=`，這支卻回報
 *  「沒有 Authority 行」）。改用 `spawnSync`，不論 exit code 都拿得到 stdout+stderr。 */
export function checkApp(path: string, expected: string): { ok: boolean; found: string | null } {
  const r = spawnSync('codesign', ['-dv', '--verbose=4', path], { encoding: 'utf8' });
  const output = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  return checkAuthorityText(output, expected);
}

async function selftest(): Promise<void> {
  const results: { name: string; ok: boolean }[] = [];
  const record = (name: string, ok: boolean): void => {
    results.push({ name, ok });
    console.log(`  ${ok ? '✅' : '❌'} ${name}`);
  };

  // ① 純字串比對 —— 不牽涉 codesign，任何平台都要跑到
  const expected = 'Developer ID Application: Chia-Hao Lu (87B8LUAZ2G)';
  const companyLine = 'Authority=Apple Distribution: Byte to Byte LLC (HCUZ6W3C9H)';
  const correctLine = `Authority=${expected}`;
  record('公司憑證的 Authority 行 → 紅', checkAuthorityText(companyLine, expected).ok === false);
  record('正確身分的 Authority 行 → 綠', checkAuthorityText(correctLine, expected).ok === true);
  record(
    '沒有 Authority 行（unsigned）→ 紅且 found 是 null',
    (() => {
      const r = checkAuthorityText('Signature=not signed at all\n', expected);
      return r.ok === false && r.found === null;
    })(),
  );

  // ② 真的呼叫 codesign：ad-hoc 簽一個假執行檔——這正是 after-pack.cjs 在憑證找不到時
  // 最終會留下的狀態（見檔頭），不是憑空想像的情境；完全離線、不用密碼。
  // 🔴 這台機器沒有 codesign（例如 CI 的 ubuntu-latest）就明確跳過並出聲，不是吞掉。
  const codesignAvailable = hasCodesign();
  let skipped = 0;
  if (!codesignAvailable) {
    skipped += 1;
    console.log(
      '  ⚠️ 跳過「真的呼叫 codesign 簽一個假執行檔再驗」——這台機器叫不動 codesign' +
        '（真的 spawn 探測過，不是猜 process.platform；ubuntu-latest 這類 CI runner 本來就沒有）',
    );
  } else {
    const { mkdtempSync, copyFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'gate-signer-selftest-'));
    const dummy = join(dir, 'dummybin');
    copyFileSync('/bin/echo', dummy);
    execFileSync('codesign', ['--force', '--sign', '-', dummy]);
    const adhoc = checkApp(dummy, expected);
    record(
      '真的對 ad-hoc 簽過的檔案跑 codesign+比對 → 紅（found 應為 null，不是隨便一個字串）',
      adhoc.ok === false && adhoc.found === null,
    );
    rmSync(dir, { recursive: true, force: true });
  }

  // ③ 真的 spawn 這支腳本本身指向空目錄，驗證 exit(2) 是真的 exit code，不是回傳值。
  // 不需要 codesign：findApps() 掃到 0 個就在呼叫 codesign 之前 exit(2) 了，任何平台都要跑到。
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const emptyDir = mkdtempSync(join(tmpdir(), 'gate-signer-empty-'));
  let exitCode = -1;
  const tsxBin = join(ROOT, 'node_modules', '.bin', 'tsx');
  const thisFile = new URL(import.meta.url).pathname;
  try {
    execFileSync(tsxBin, [thisFile], {
      encoding: 'utf8',
      env: { ...process.env, GATE_SIGNER_ROOT: emptyDir, GATE_SIGNER_FORCE_DARWIN: '1' },
    });
    exitCode = 0;
  } catch (e) {
    exitCode = (e as { status?: number }).status ?? -1;
  }
  rmSync(emptyDir, { recursive: true, force: true });
  record(
    '掃到 0 個 .app 的目錄 → 子行程真的用 exit code 2 結束（不需要 codesign）',
    exitCode === 2,
  );

  const allOk = results.every((r) => r.ok);
  const note =
    skipped > 0 ? `（跳過 ${skipped} 條依賴 codesign 的斷言，這台機器沒有 codesign）` : '';
  console.log(allOk ? `selftest PASS${note}` : 'selftest FAIL');
  process.exit(allOk ? 0 : 1);
}

async function main(): Promise<void> {
  if (process.argv.includes('--selftest')) {
    await selftest();
    return;
  }

  // 非 macOS：codesign 不存在、mac: 段落也不會被 build——不適用，不是「掃到 0 個」。
  const forcedDarwin = process.env['GATE_SIGNER_FORCE_DARWIN'] === '1';
  if (process.platform !== 'darwin' && !forcedDarwin) {
    console.log('gate:signer SKIP — 非 macOS runner，這個 gate 的守備範圍不適用');
    process.exit(0);
  }

  const configPath = join(ROOT, 'electron-builder.yml');
  const expected = expectedAuthority(configPath);
  const distAppRoot = process.env['GATE_SIGNER_ROOT'] ?? join(ROOT, 'dist-app');
  const apps = findApps(distAppRoot);

  if (apps.length === 0) {
    console.error(
      `gate:signer FAIL(2) — 在 ${relative(ROOT, distAppRoot) || distAppRoot} 掃到 0 個 .app，` +
        '沒有東西可驗＝尺壞了，不能算過。先跑過 electron-builder 產出 .app 再驗這支。',
    );
    process.exit(2);
  }

  const bad: { app: string; found: string | null }[] = [];
  for (const app of apps) {
    const { ok, found } = checkApp(app, expected);
    if (!ok) bad.push({ app: relative(ROOT, app), found });
  }

  if (bad.length > 0) {
    console.error(`gate:signer FAIL — ${bad.length}/${apps.length} 個 .app 簽章者不對`);
    console.error(`  期望：${expected}`);
    for (const b of bad)
      console.error(`  ${b.app}\n    實際讀到：${b.found ?? '(沒有 Authority 行 / 未簽章)'}`);
    process.exit(1);
  }

  console.log(`gate:signer PASS — ${apps.length} 個 .app 全部是 ${expected}`);
}

await main();
