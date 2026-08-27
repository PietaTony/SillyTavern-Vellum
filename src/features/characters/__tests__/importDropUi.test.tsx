import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImportDropZone } from '../ui/ImportDropZone';
import { ImportErrorPanel } from '../ui/ImportErrorPanel';
import { ImportSelectedPanel } from '../ui/ImportSelectedPanel';
import type { DragHandlers } from '../ui/useImportDrop';

const noopDrag: DragHandlers = {
  onDragEnter: vi.fn(),
  onDragOver: vi.fn(),
  onDragLeave: vi.fn(),
  onDrop: vi.fn(),
};

describe('ImportDropZone（空狀態／拖曳中）', () => {
  it('空狀態說得出支援 PNG，且沒有「放開」字樣', () => {
    render(<ImportDropZone dragging={false} dragProps={noopDrag} onFile={vi.fn()} />);
    expect(screen.getByText('把角色卡 PNG 拖進來')).toBeTruthy();
    expect(screen.getByText(/支援 PNG 格式/)).toBeTruthy();
    expect(screen.queryByText('放開就開始匯入')).toBeNull();
  });

  it('拖曳中換成「放開就開始匯入」', () => {
    render(<ImportDropZone dragging onFile={vi.fn()} dragProps={noopDrag} />);
    expect(screen.getByText('放開就開始匯入')).toBeTruthy();
  });

  it('選檔案會把 File 交給 onFile', () => {
    const onFile = vi.fn();
    render(<ImportDropZone dragging={false} dragProps={noopDrag} onFile={onFile} />);
    const input = screen.getByLabelText('選擇角色卡檔案') as HTMLInputElement;
    const file = new File(['x'], 'card.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('拖放檔案到框上會呼叫 dragProps.onDrop', () => {
    const onDrop = vi.fn();
    const { container } = render(
      <ImportDropZone dragging={false} onFile={vi.fn()} dragProps={{ ...noopDrag, onDrop }} />,
    );
    fireEvent.drop(container.firstChild as Element);
    expect(onDrop).toHaveBeenCalled();
  });
});

describe('ImportSelectedPanel（選好了／進行中）', () => {
  it('顯示檔名與大小', () => {
    const file = new File([new Uint8Array(2048)], 'my-card.png', { type: 'image/png' });
    render(
      <ImportSelectedPanel file={file} uploading={false} onCancel={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText('my-card.png')).toBeTruthy();
    expect(screen.getByText(/KB|B/)).toBeTruthy();
  });

  it('按「取消選擇」會呼叫 onCancel', () => {
    const onCancel = vi.fn();
    const file = new File(['x'], 'card.png', { type: 'image/png' });
    render(
      <ImportSelectedPanel file={file} uploading={false} onCancel={onCancel} onSubmit={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('取消選擇'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('進行中時「取消選擇」要 disabled，鈕文案變成「匯入中…」', () => {
    const file = new File(['x'], 'card.png', { type: 'image/png' });
    render(<ImportSelectedPanel file={file} uploading onCancel={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText('取消選擇')).toHaveProperty('disabled', true);
    expect(screen.getByText('匯入中…')).toBeTruthy();
  });
});

describe('ImportErrorPanel（錯誤）', () => {
  it('顯示引導文案，按「選別的檔案」呼叫 onRetry', () => {
    const onRetry = vi.fn();
    render(<ImportErrorPanel message="這不是 PNG 檔，換一張試試" onRetry={onRetry} />);
    expect(screen.getByText(/換一張試試/)).toBeTruthy();
    fireEvent.click(screen.getByText('選別的檔案'));
    expect(onRetry).toHaveBeenCalled();
  });
});
