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
    },
  }),
);
