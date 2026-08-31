import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GlobalWorld } from '../api';
import { GlobalWorldList } from '../ui/GlobalWorldList';

const WORLDS: GlobalWorld[] = [
  { id: 'g1', name: '第一本', entryCount: 3, enabledCount: 1 },
  { id: 'g2', name: '第二本', entryCount: 5, enabledCount: 5 },
];

/**
 * 🔴 B9：`renameGlobalWorld()`（`api.ts`）與後端 `PATCH /api/global-worlds/:id`
 * 早就通了，`git grep "renameGlobalWorld" src` 過去只命中定義與 re-export——
 * 零呼叫端，使用者改不了世界書的名字。這支釘住「改名鈕真的接得到 `onRename`」，
 * 不只是「元件存在」。
 */
describe('GlobalWorldList（B9：改名鈕）', () => {
  it('🔴 按編輯鈕、改文字、按存起來 —— onRename 帶著新名字被呼叫', async () => {
    const onRename = vi.fn();
    render(
      <GlobalWorldList
        items={WORLDS}
        busyId={null}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onRename={onRename}
      />,
    );

    fireEvent.click(screen.getByLabelText('改「第一本」的名字'));
    await waitFor(() => expect(screen.getByLabelText('世界書名字')).toBeTruthy());

    const input = screen.getByLabelText('世界書名字') as HTMLInputElement;
    expect(input.value).toBe('第一本'); // 挖空只清空欄位或不帶入現值的話這裡先紅

    fireEvent.change(input, { target: { value: '改過的名字' } });
    fireEvent.click(screen.getByText('存起來'));

    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith(WORLDS[0], '改過的名字');
  });

  it('🔴 取消不呼叫 onRename —— 改一半反悔要真的不送出', async () => {
    const onRename = vi.fn();
    render(
      <GlobalWorldList
        items={WORLDS}
        busyId={null}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onRename={onRename}
      />,
    );

    fireEvent.click(screen.getByLabelText('改「第二本」的名字'));
    await waitFor(() => expect(screen.getByLabelText('世界書名字')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('世界書名字'), { target: { value: '不算數' } });
    fireEvent.click(screen.getByText('取消'));

    expect(onRename).not.toHaveBeenCalled();
  });

  it('空白名字存不起來 —— 按鈕要是 disabled', async () => {
    const onRename = vi.fn();
    render(
      <GlobalWorldList
        items={WORLDS}
        busyId={null}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onRename={onRename}
      />,
    );

    fireEvent.click(screen.getByLabelText('改「第一本」的名字'));
    await waitFor(() => expect(screen.getByLabelText('世界書名字')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('世界書名字'), { target: { value: '   ' } });

    expect(screen.getByText('存起來').closest('button')).toBeDisabled();
    expect(onRename).not.toHaveBeenCalled();
  });
});
