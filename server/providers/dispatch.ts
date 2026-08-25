/**
 * 格式 → 適配器。**這是全專案唯一一處把「哪一家」變成「哪一支 code」的地方。**
 *
 * 🔴 判準（規格 §4.1）：**一種格式一支適配器**。
 * 不因為「這家是新的供應商」就新增檔案 —— 那正是 ST 複製 9 份的路。
 */
import { anthropic } from './formats/anthropic.ts';
import { cohere } from './formats/cohere.ts';
import { gemini } from './formats/gemini.ts';
import { openaiCompat } from './formats/openaiCompat.ts';
import type { Adapter, Format } from './types.ts';

const BY_FORMAT: Record<Format, Adapter> = {
  openai: openaiCompat,
  anthropic,
  gemini,
  cohere,
};

export const adapterFor = (format: Format): Adapter => BY_FORMAT[format];

/** 四種格式各有一支，且**不存在「同一格式兩支實作」**（驗收 A3）。 */
export const FORMATS = Object.keys(BY_FORMAT) as Format[];
