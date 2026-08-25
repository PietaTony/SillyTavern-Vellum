import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readDraft, writeDraft } from '@/shared/lib/draftStore';
import { Composer } from '../ui/Composer';

const CHAT = 'chat-1';
const KEY = `vellum.draft.chat.${CHAT}`;
const box = () => screen.getByLabelText('輸入訊息') as HTMLTextAreaElement;

beforeEach(() => localStorage.clear());

describe('Composer 的草稿與送出', () => {
  it('重新載入之後草稿還在（＝ iOS 把背景分頁丟掉重建）', () => {
    writeDraft(KEY, '打到一半的話');
    render(<Composer chatId={CHAT} busy={false} onSend={vi.fn()} />);
    expect(box().value).toBe('打到一半的話');
  });

  /**
   * 🔴 **驗收 A4。** 在此之前 `Composer` 是**先清空再送**——
   * `appendMessage` 一丟例外（網路斷、金鑰過期、429），打過的字就真的沒了。
   * 掉字有兩種：「還沒送出就沒了」與「**送出失敗才沒了**」，這條守後者。
   */
  it('🔴 A4 送出失敗時內容留在輸入框，草稿也還在', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('500'));
    render(<Composer chatId={CHAT} busy={false} onSend={onSend} />);
    fireEvent.change(box(), { target: { value: '這句不可以消失' } });
    fireEvent.click(screen.getByLabelText('送出'));

    await waitFor(() => expect(onSend).toHaveBeenCalledWith('這句不可以消失'));
    expect(box().value).toBe('這句不可以消失');
    await waitFor(() => expect(readDraft<string>(KEY)).toBe('這句不可以消失'));
  });

  it('送出成功才清空，而且草稿那一筆也刪掉', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<Composer chatId={CHAT} busy={false} onSend={onSend} />);
    fireEvent.change(box(), { target: { value: '送得出去' } });
    fireEvent.click(screen.getByLabelText('送出'));

    await waitFor(() => expect(box().value).toBe(''));
    await waitFor(() => expect(readDraft(KEY)).toBeNull());
  });

  it('空白內容不會送出', () => {
    const onSend = vi.fn();
    render(<Composer chatId={CHAT} busy={false} onSend={onSend} />);
    fireEvent.change(box(), { target: { value: '   ' } });
    fireEvent.click(screen.getByLabelText('送出'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('每段對話各自一份草稿，不會互相看到', () => {
    writeDraft('vellum.draft.chat.other', '別段的話');
    render(<Composer chatId={CHAT} busy={false} onSend={vi.fn()} />);
    expect(box().value).toBe('');
  });
});
