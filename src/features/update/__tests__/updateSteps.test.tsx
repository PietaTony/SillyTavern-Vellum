import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UpdateSteps } from '../ui/UpdateSteps';
import { RELEASES_URL, UPDATE_STEPS } from '../updateSteps';

/**
 * 更新入口不可以再說謊（2026-08-27，移除 Docker 之後）。
 *
 * 🔴 上一版畫面上是 `docker compose pull && docker compose up -d` 加一顆「複製指令」。
 * Docker 移除之後那條**永遠跑不起來**；而換成另一條指令只是換一個新的謊 ——
 * 走 zip 的使用者沒有 git、沒有 pnpm，這件事本來就沒有單行指令做得到。
 *
 * 🔴 **這支用渲染驗，不是比對原始碼字串。** 「原始碼裡沒有 docker」擋不住
 * 「有人換了另一條指令上去」——要驗的是**畫面上有沒有一顆給指令的按鈕**。
 */
describe('更新入口', () => {
  it('🔴 畫面上沒有任何「複製」按鈕 —— 那是可複製指令的入口', () => {
    render(<UpdateSteps />);
    expect(screen.queryByRole('button', { name: /複製/ })).toBeNull();
  });

  it('🔴 畫面上不出現看起來像 shell 指令的文字', () => {
    const { container } = render(<UpdateSteps />);
    const text = container.textContent ?? '';
    for (const bad of ['docker', 'compose', 'pnpm ', 'git ', 'npm ', '&&', 'sudo']) {
      expect(text.toLowerCase(), `畫面上出現了指令片段「${bad}」`).not.toContain(bad);
    }
  });

  it('有一顆按鈕開得了 Releases 頁', () => {
    render(<UpdateSteps />);
    const link = screen.getByRole('link', { name: /下載頁/ });
    expect(link).toHaveAttribute('href', RELEASES_URL);
    expect(link).toHaveAttribute('target', '_blank');
    // 🔴 `target="_blank"` 沒有 `rel="noreferrer"` 就是把 opener 交出去。
    expect(link.getAttribute('rel')).toContain('noreferrer');
  });

  it('三個步驟都印出來了', () => {
    render(<UpdateSteps />);
    for (const step of UPDATE_STEPS) expect(screen.getByText(step)).toBeTruthy();
  });

  /**
   * 🔴 **第 2 步是全部的重點**：忘了搬 `data/` 就是「更新完什麼都不見了」，
   * 而畫面會顯示成正常的空狀態 —— 看不出是災難。所以它必須講到 data。
   */
  it('第 2 步一定要講到 data 資料夾', () => {
    expect(UPDATE_STEPS[1]).toContain('data');
  });

  it('步驟裡不可以留 markdown 記號 —— 那幾行是直接丟進 Typography 的', () => {
    for (const step of UPDATE_STEPS) {
      expect(step, `「${step}」帶了 markdown 記號`).not.toMatch(/\*\*|`/);
    }
  });

  it('沒有 notesUrl 時不渲染「完整說明」，不是渲染一顆點了沒反應的按鈕', () => {
    render(<UpdateSteps />);
    expect(screen.queryByRole('link', { name: /完整說明/ })).toBeNull();
  });
});
