/**
 * 這支在守什麼：**新 worktree 從零到 `pnpm typecheck` 綠燈，只要一條指令。**
 *
 * 為什麼：`src/app/routeTree.gen.ts` 被 `.gitignore:11` 排除、不進版控
 * （tanstackRouter 產生，見 `vite.config.ts`）。但 `src/app/router.ts` import 它，
 * 21 個 route 檔的 `createFileRoute()` 也靠它把字面型別跟 route tree 對起來。
 * 新 worktree `pnpm install` 之後這個檔不存在，`pnpm typecheck` 紅 22 個錯
 * （1 個 `Cannot find module './routeTree.gen'`，21 個具誤導性的 `TS2345`），
 * 而錯誤訊息完全不提「你少跑一次 build」。每個新 agent 都要重走一次這段
 * 跟任務無關的路。
 *
 * 只做一件事：`vite build`（tanstackRouter plugin 的 generator 附在裡面，
 * 位元確定性——刪掉 routeTree.gen.ts 再 build，生回來跟原本 diff 完全相同）
 * 生成 `routeTree.gen.ts`，然後**自己**跑 `tsc --noEmit` 驗證真的綠了才收工。
 * 紅：非零 exit，並講清楚是這支腳本的 bug、不是使用者少做什麼——不吞失敗。
 *
 * 🔴 雞生蛋：這支本身要用 `tsx` 執行，但一棵全新的樹還沒有 `node_modules`。
 * 入口（package.json 的 `setup:worktree`）第一步一定是 `pnpm install`
 * 這個 shell 指令本身，`pnpm exec tsx scripts/setup-worktree.ts` 接在後面。
 *
 * 🔴 不屬於 `gate-*.ts` 家族（不掃檔案、不進 `gate:selftest` 迴圈），
 * 所以沒有 `--selftest`；用「弄壞一個 route 檔讓 typecheck 紅
 * → 這支要以非零 exit 講出來」做突變證明，記在派工回報裡。
 *
 * ⚠️ 不做：把 `routeTree.gen.ts` 加進版控、新增 `gate:routetree`——
 * 2026-08-28 Peter 已否決（三個新機制換 `vite build` 的 214ms，不划算，
 * 見派工單）。這支腳本的存在本身就是那個否決的替代方案。
 */
import { execSync } from 'node:child_process';

function run(label: string, cmd: string): { ok: boolean; output: string } {
  console.log(`[setup:worktree] ${label}...`);
  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    return { ok: true, output };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const output = [err.stdout, err.stderr, err.message].filter(Boolean).join('\n');
    return { ok: false, output };
  }
}

const build = run('產生 src/app/routeTree.gen.ts（vite build）', 'pnpm exec vite build');
if (!build.ok) {
  console.error('[setup:worktree] FAIL — vite build 沒能生出 routeTree.gen.ts。');
  console.error('這是 setup:worktree 的 bug，不是你少做了什麼：');
  console.error(build.output);
  process.exit(1);
}

const check = run('驗證 pnpm typecheck 真的綠了', 'pnpm exec tsc --noEmit');
if (!check.ok) {
  console.error('[setup:worktree] FAIL — routeTree.gen.ts 生成後 typecheck 仍是紅的。');
  console.error('這是 setup:worktree 的 bug，不是你少做了什麼：');
  console.error(check.output);
  process.exit(1);
}

console.log('[setup:worktree] PASS — routeTree.gen.ts 已生成，pnpm typecheck 綠燈。');
