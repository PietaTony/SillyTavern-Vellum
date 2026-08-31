import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  MAX_MAX_OUTPUT_TOKENS,
  MIN_MAX_OUTPUT_TOKENS,
} from '../lib/maxResponseTokens.ts';

/**
 * B5：`maxResponseTokens.ts` 的三個邊界數字是 `generate.ts` Body schema 的**重複**，
 * 不是唯一正本（`generate.ts` 現在是 H5 借走的，這張票不能碰它，理由見
 * `maxResponseTokens.ts` 檔頭）。
 *
 * 🔴 **這支不是驗「我記得對」，是量測管道自證**：直接讀 `generate.ts` 的原始碼文字、
 * 用同一段正則抓出三個數字比對。兩邊手動保持一致，這支就是撞到「有人改了一邊、
 * 忘了改另一邊」的第一道警報——把任一邊改掉都要讓它紅（下面兩個 it 各自證明一次）。
 */
describe('maxResponseTokens 常數與 generate.ts 的 Body schema 同步', () => {
  it('generate.ts 裡的字面數字（256／65_536／4096）跟這支常數逐一相等', () => {
    const src = readFileSync(join(import.meta.dirname, '../routes/generate.ts'), 'utf8');
    const m = src.match(
      /maxOutputTokens: z\.number\(\)\.int\(\)\.min\((\d+)\)\.max\((\d+_?\d*)\)\.default\((\d+)\)/,
    );
    expect(m, 'generate.ts 找不到 maxOutputTokens 那行 —— 正則本身要先更新').not.toBeNull();
    const [, min, max, def] = m as unknown as [string, string, string, string];
    expect(Number(min)).toBe(MIN_MAX_OUTPUT_TOKENS);
    expect(Number(max.replace('_', ''))).toBe(MAX_MAX_OUTPUT_TOKENS);
    expect(Number(def)).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
  });

  it('🔴 突變證明：這支常數本身要是具體數字，不是隨便寫的（挖空成 0 或 Infinity 都要跟 generate.ts 對不上而紅）', () => {
    expect(MIN_MAX_OUTPUT_TOKENS).toBe(256);
    expect(MAX_MAX_OUTPUT_TOKENS).toBe(65_536);
    expect(DEFAULT_MAX_OUTPUT_TOKENS).toBe(4096);
    expect(MIN_MAX_OUTPUT_TOKENS).toBeLessThan(DEFAULT_MAX_OUTPUT_TOKENS);
    expect(DEFAULT_MAX_OUTPUT_TOKENS).toBeLessThan(MAX_MAX_OUTPUT_TOKENS);
  });
});
