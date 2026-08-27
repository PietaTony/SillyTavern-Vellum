/**
 * 產生／檢查 `THIRD-PARTY-NOTICES.md` —— **散布義務，不是禮貌**。
 *
 * 🔴 **為什麼現在才需要**：以前 lodash／jQuery／js-yaml 是 CDN 外連 ⇒ 我們沒有散布它們。
 * 2026-08-27 起它們被內嵌進 `vendor/`，**進了 zip／exe／dmg ⇒ 就是散布**。
 * ⚠️ 但範圍不只那三支（`vellum-ui` 提醒的）：`dompurify`／`showdown`／MUI／React
 * **本來就**被 Vite 與 esbuild 打包進產物裡 —— 這件事在內嵌之前就成立了，只是沒人做。
 *
 * 🔴 **MIT／BSD／ISC 全都要求「保留版權聲明與授權全文」**。少了那份檔案，
 * 我們散布的每一包都在違反上百個套件的授權 —— 而且它不會有任何錯誤訊息。
 *
 * ⚠️ **`--prod` 不等於「會被散布的」**，兩個方向都要補：
 *   · `vendor/` 那三支被裝成 `devDependencies`（只為了鎖版本），但**檔案 commit 在 repo 裡會散布** ⇒ 要加回來。
 *   · 反過來 devDependencies 的建置工具不會進產物 ⇒ 不列。
 * 判準是**「這份 code 有沒有跟著散布」**，不是「它在 package.json 的哪一欄」。
 *
 * 自證：`pnpm exec tsx scripts/notices.ts --selftest`
 * 產生：`pnpm notices`　｜　檢查有沒有過期：`pnpm gate:licenses`
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'THIRD-PARTY-NOTICES.md');
/**
 * 🔴 **用樣式比對不要列舉檔名。** 第一版列了六個常見名字，結果 `jsesc` 的
 * `LICENSE-MIT.txt` 沒被涵蓋 —— 而它的症狀是「這個套件沒有授權全文」，
 * 跟「它真的沒附」長得一模一樣。**尺太窄與義務不存在，在輸出上分不出來。**
 */
const LICENSE_RE = /^(licen[sc]e|copying|notice)/i;

export type Pkg = {
  name: string;
  version: string;
  license: string;
  homepage?: string;
  text: string;
};

/** 從套件目錄撈授權全文。撈不到回空字串 —— **要看得出來是撈不到，不是沒有義務**。 */
export function licenseTextIn(dir: string): string {
  if (!dir || !existsSync(dir)) return '';
  const hit = readdirSync(dir)
    .filter((f) => LICENSE_RE.test(f))
    .sort((a, b) => a.length - b.length)[0];
  return hit ? readFileSync(join(dir, hit), 'utf8').trim() : '';
}

/** 產生檔案內容。純函式，好測。 */
export function render(pkgs: Pkg[]): string {
  const byLicense = new Map<string, number>();
  for (const p of pkgs) byLicense.set(p.license, (byLicense.get(p.license) ?? 0) + 1);
  const head = [
    '# 第三方授權聲明',
    '',
    '> **這份檔案是自動產生的，不要手改。** 產生方式：`pnpm notices`',
    '> 過期會被 `pnpm gate:licenses` 擋下來（`pnpm verify` 會跑）。',
    '',
    'Vellum 本身授權 **AGPL-3.0-or-later**（見 `LICENSE`）。',
    '下面這些是**跟著我們一起散布**的第三方軟體 —— 打包進 `.zip`／`.exe`／`.dmg` 的、',
    '以及 commit 在 `vendor/` 的。它們各自的授權要求保留版權聲明與授權全文，這份檔案就是。',
    '',
    '⚠️ **這份清單是保守的**：列的是整棵 production 相依樹，其中有些會被 tree-shaking',
    '拿掉、不會真的進到產物裡。**多列不違反任何授權，少列會** —— 所以寧可多。',
    '',
    `共 **${pkgs.length}** 個套件：`,
    '',
    '| 授權 | 個數 |',
    '|---|---|',
    ...[...byLicense.entries()].sort((a, b) => b[1] - a[1]).map(([l, n]) => `| ${l} | ${n} |`),
    '',
    '---',
    '',
  ];
  const body = pkgs.map((p) => {
    const link = p.homepage ? `　·　${p.homepage}` : '';
    // 🔴 撈不到就明講「套件沒附」，**不要自己生一份 MIT 全文** ——
    //    那會憑空捏造一個版權人，比缺漏更糟。
    const text =
      p.text ||
      `⚠️ 這個套件的發行內容裡沒有附授權檔，只在 package.json 宣告 ${p.license}。\n` +
        `授權全文請見上面的專案網址。**不要在這裡自己補一份，那等於捏造版權人。**`;
    return `## ${p.name} ${p.version}\n\n**${p.license}**${link}\n\n\`\`\`\n${text}\n\`\`\`\n`;
  });
  return [...head, ...body].join('\n');
}

/** `pnpm licenses list --prod --json` ＋ `vendor/`。**兩邊都要**，理由見檔頭。 */
function collect(): Pkg[] {
  const raw = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const parsed = JSON.parse(raw) as Record<
    string,
    { name: string; versions: string[]; paths: string[]; license: string; homepage?: string }[]
  >;
  const out: Pkg[] = [];
  for (const list of Object.values(parsed))
    for (const e of list)
      out.push({
        name: e.name,
        version: e.versions.join('、'),
        license: e.license,
        ...(e.homepage ? { homepage: e.homepage } : {}),
        text: licenseTextIn(e.paths[0] ?? ''),
      });

  // 🔴 `vendor/` 裡的是 devDependencies（只為鎖版本），但檔案會跟著散布 ⇒ 一定要列。
  const vendorDir = join(ROOT, 'vendor');
  if (existsSync(vendorDir))
    for (const f of readdirSync(vendorDir).filter((x) => x.endsWith('.js'))) {
      const name = f.replace(/\.min\.js$|\.js$/, '');
      const dir = join(ROOT, 'node_modules', name);
      const meta = existsSync(join(dir, 'package.json'))
        ? (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
            version?: string;
            license?: string;
            homepage?: string;
          })
        : {};
      out.push({
        name: `${name}（內嵌於 vendor/${f}）`,
        version: meta.version ?? '（查不到版本 —— 要人工補）',
        license: meta.license ?? '（查不到授權 —— 要人工補）',
        ...(meta.homepage ? { homepage: meta.homepage } : {}),
        text: licenseTextIn(dir),
      });
    }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

if (process.argv.includes('--selftest')) {
  const cases: [string, boolean][] = [
    [
      '列出套件數',
      render([{ name: 'a', version: '1', license: 'MIT', text: 'x' }]).includes('共 **1** 個套件'),
    ],
    [
      '授權全文有進去',
      render([{ name: 'a', version: '1', license: 'MIT', text: '版權全文在此' }]).includes(
        '版權全文在此',
      ),
    ],
    [
      '🔴 撈不到授權檔要出聲，不可以留白',
      render([{ name: 'a', version: '1', license: 'MIT', text: '' }]).includes('沒有附授權檔'),
    ],
    [
      '授權種類統計',
      render([{ name: 'a', version: '1', license: 'ISC', text: 'x' }]).includes('| ISC | 1 |'),
    ],
    ['空清單不會爆', render([]).includes('共 **0** 個套件')],
  ];
  const bad = cases.filter(([, ok]) => !ok);
  for (const [n] of bad) console.error(`  selftest FAIL：${n}`);
  console.log(
    bad.length ? `selftest FAIL（${bad.length} 條）` : `selftest PASS（${cases.length} 條）`,
  );
  process.exit(bad.length ? 1 : 0);
}

const pkgs = collect();
// 🔴 掃到 0 個不是成功 —— 比對 0 個項目必然通過，那是假綠燈。
if (pkgs.length === 0) {
  console.error('notices FAIL — 一個套件都沒讀到，是尺壞了不是真的沒有相依');
  process.exit(1);
}
const next = render(pkgs);

if (process.argv.includes('--check')) {
  const now = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (now === next) {
    console.log(`gate:licenses PASS — THIRD-PARTY-NOTICES.md 與 ${pkgs.length} 個散布中的套件一致`);
    process.exit(0);
  }
  console.error('gate:licenses FAIL — THIRD-PARTY-NOTICES.md 過期了（相依變了但沒重新產生）');
  console.error('  ⇒ 跑 `pnpm notices` 之後把結果一起 commit。');
  // 🔴 **印第一行差異，不是印長度。** 第一版印的是字元數，而兩份內容不同、
  //    長度剛好一樣時它會印出「目前 177727 字元，應該是 177727 字元」—— 等於沒說。
  const a = now.split('\n');
  const b = next.split('\n');
  const i = a.findIndex((l, k) => l !== b[k]);
  console.error(`  第一行差異在第 ${i + 1} 行：`);
  console.error(`    現在：${(a[i] ?? '（檔案到這裡就沒了）').slice(0, 120)}`);
  console.error(`    應該：${(b[i] ?? '（應該到這裡就結束）').slice(0, 120)}`);
  process.exit(1);
}

writeFileSync(OUT, next);
console.log(`寫出 THIRD-PARTY-NOTICES.md —— ${pkgs.length} 個套件`);
const missing = pkgs.filter((p) => !p.text);
if (missing.length)
  console.warn(
    `⚠️ 有 ${missing.length} 個撈不到授權全文，要人工補：${missing.map((m) => m.name).join('、')}`,
  );
