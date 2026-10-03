import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      // 🔴 `server/` 本來不在掃描範圍內 —— 加了測試檔卻沒被撿到，
      // 測試數字不會變，看起來就像「一切正常」。零命中不是綠燈。
      include: ['src/**/*.{test,spec}.{ts,tsx}', 'server/**/*.{test,spec}.ts'],
      // 🔴 `'stack'`（預設）只反轉 after* hook 的「同一支檔自己註冊的那幾個」——
      // `setupFiles` 裡註冊的 `afterEach` 永遠排第一個註冊，`'stack'` 下反而永遠**最後執行**，
      // 跑在每支測試檔自己的 `afterEach`（例如 `rmSync(root)`）**之後**，等於白寫。
      // 改成 `'list'`（照註冊順序跑）才會讓全域收尾（`src/test-setup.ts` 等快照落地）
      // 跑在各檔自己的 `afterEach` 之前。
      // ⚠️ 核過**整個 repo**：目前沒有任何一支測試檔在同一層註冊兩個以上的 `afterEach`／
      // `afterAll`（`grep -c 'afterEach('` 每支最多 1），`beforeEach`/`beforeAll` 在
      // `'stack'` 下本來就是正序 —— 所以這個全域切換**唯一會改變順序的地方**就是
      // 「全域收尾 vs. 各檔自己那一個」，不會打亂任何現有測試原本預期的 hook 順序。
      // 之後如果有人在同一支檔案疊第二個 `afterEach`/`afterAll`，順序語意會變，
      // 要重新核過一次（這就是這段註解在講的事，不是裝飾）。
      sequence: { hooks: 'list' },
    },
  }),
);
