import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '@/app/theme';
import { PersonaPositionFields } from '../ui/PersonaPositionFields';

/**
 * ST 落差重掃：`position`／`depth` 引擎完整（`server/lib/personaPrompt.ts`），
 * 前端型別也有（`api.ts`），但 `src/features/persona/` 底下從沒有控制項——
 * 這支守的就是「這個控制項真的存在，而且真的把選到的值往上送」。
 *
 * 🔴 三層都要顧到（跟 worldbook `EntryEditor.test.tsx` 同一種分工）：
 * ① 選單真的畫出五個位置 ② 未接線的兩個要誠實標「（尚未接線）」
 * ③ 選了會透過 `onChange` 把值送出去——挖空這條路（比如 `onChange` 被砍成 no-op）
 *   下面「選了 at_depth 之後真的呼叫 onChange」那組測試會紅，且只有那裡紅。
 */
function openPositionSelect() {
  fireEvent.mouseDown(screen.getByLabelText('插在哪裡'));
}

describe('PersonaPositionFields：插入位置＋深度', () => {
  it('五個位置都畫出來，且順序照 ST', () => {
    render(
      <ThemeProvider theme={theme}>
        <PersonaPositionFields position="in_prompt" depth={4} onChange={vi.fn()} />
      </ThemeProvider>,
    );
    openPositionSelect();
    expect(screen.getByRole('option', { name: '跟角色描述一起（預設）' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '作者備註之前（尚未接線）' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '作者備註之後（尚未接線）' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '插進對話裡' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '不要進 prompt' })).toBeTruthy();
  });

  it('🔴 選到未接線位置：收合狀態不必展開選單就看得到「尚未接線」（helperText）', () => {
    render(
      <ThemeProvider theme={theme}>
        <PersonaPositionFields position="top_an" depth={4} onChange={vi.fn()} />
      </ThemeProvider>,
    );
    expect(screen.getAllByText(/尚未接線/).length).toBeGreaterThan(0);
  });

  it('position 不是 at_depth 時，深度欄位不畫出來', () => {
    render(
      <ThemeProvider theme={theme}>
        <PersonaPositionFields position="in_prompt" depth={4} onChange={vi.fn()} />
      </ThemeProvider>,
    );
    expect(screen.queryByLabelText('深度（往回第幾則）')).toBeNull();
  });

  it('🔴 挖空證明①：選「插進對話裡」要用具體的 position 字串呼叫 onChange，不是「有呼叫就好」', () => {
    const onChange = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <PersonaPositionFields position="in_prompt" depth={4} onChange={onChange} />
      </ThemeProvider>,
    );
    openPositionSelect();
    fireEvent.click(screen.getByRole('option', { name: '插進對話裡' }));
    expect(onChange).toHaveBeenCalledWith({ position: 'at_depth' });
  });

  it('🔴 挖空證明②：position 是 at_depth 時深度欄位出現，改深度要用具體數字呼叫 onChange', () => {
    const onChange = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <PersonaPositionFields position="at_depth" depth={4} onChange={onChange} />
      </ThemeProvider>,
    );
    const field = screen.getByLabelText('深度（往回第幾則）');
    fireEvent.change(field, { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith({ depth: 7 });
  });

  it('深度輸入非數字時夾成 0，不會把 NaN 送給後端', () => {
    const onChange = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <PersonaPositionFields position="at_depth" depth={4} onChange={onChange} />
      </ThemeProvider>,
    );
    const field = screen.getByLabelText('深度（往回第幾則）');
    fireEvent.change(field, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith({ depth: 0 });
  });
});
