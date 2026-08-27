import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NetworkState } from '../api';
import { NetworkCard } from '../ui/NetworkCard';

/**
 * 「允許其他裝置連線」開關。
 *
 * 🔴 **這顆開關會把使用者的全部對話與 API 金鑰放到網路上。**
 * 所以測試守的不是「開關能不能按」，是**它有沒有說實話**：
 *   ① 設定值 ≠ 實際綁的介面時，要說「還沒生效」——不可以看起來已經開了
 *   ② 要講明「不只 Tailscale，同一個 wifi 的人也連得到」
 *   ③ 要講明「沒有登入機制」
 */
const base: NetworkState = {
  enabled: false,
  bound: '127.0.0.1',
  forcedByEnv: false,
  port: 8520,
  urls: [],
};
const noop = () => undefined;

/** MUI 的 `Switch` 底下是一個 `input[type=checkbox]`，直接抓它最不會被版本差異影響。 */
const sw = (c: HTMLElement): HTMLInputElement => {
  const el = c.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!el) throw new Error('找不到開關 —— 版面改了就要回來改這支測試');
  return el;
};

describe('允許其他裝置連線', () => {
  it('🔴 打開了但還沒重啟 ⇒ 要說「還沒生效」', () => {
    const { container } = render(
      <NetworkCard state={{ ...base, enabled: true }} onToggle={noop} busy={false} />,
    );
    expect(container.textContent).toContain('要重新啟動');
    expect(container.textContent).toContain('只有這台電腦連得到');
  });

  it('🔴 關掉了但還在開放中 ⇒ 一樣要說「還沒生效」，而且要說仍然開放', () => {
    const { container } = render(
      <NetworkCard
        state={{ ...base, enabled: false, bound: '0.0.0.0' }}
        onToggle={noop}
        busy={false}
      />,
    );
    expect(container.textContent).toContain('要重新啟動');
    expect(container.textContent).toContain('仍然開放中');
  });

  it('設定值與實際一致時不該出現「要重新啟動」', () => {
    const { container } = render(
      <NetworkCard
        state={{ ...base, enabled: true, bound: '0.0.0.0' }}
        onToggle={noop}
        busy={false}
      />,
    );
    expect(container.textContent).not.toContain('要重新啟動');
  });

  it('🔴 一定要講「不只 Tailscale，同一個 wifi 的人也連得到」', () => {
    const { container } = render(<NetworkCard state={base} onToggle={noop} busy={false} />);
    expect(container.textContent).toContain('wifi');
    expect(container.textContent).toContain('不只 Tailscale');
  });

  it('🔴 一定要講「沒有登入機制」', () => {
    const { container } = render(<NetworkCard state={base} onToggle={noop} busy={false} />);
    expect(container.textContent).toContain('沒有登入機制');
  });

  it('開放中會列出手機要打的網址，Tailscale 標示得出來', () => {
    const { container } = render(
      <NetworkCard
        state={{
          ...base,
          enabled: true,
          bound: '0.0.0.0',
          urls: [{ kind: 'tailscale', url: 'http://100.89.95.93:8520' }],
        }}
        onToggle={noop}
        busy={false}
      />,
    );
    expect(container.textContent).toContain('http://100.89.95.93:8520');
    expect(container.textContent).toContain('Tailscale');
  });

  it('🔴 開放中卻找不到對外位址 ⇒ 要說出來，不是列一個空清單', () => {
    const { container } = render(
      <NetworkCard
        state={{ ...base, enabled: true, bound: '0.0.0.0' }}
        onToggle={noop}
        busy={false}
      />,
    );
    expect(container.textContent).toContain('找不到任何對外的網路位址');
  });

  it('🔴 HOST 環境變數蓋過設定時，開關要 disabled 並說明', () => {
    const { container } = render(
      <NetworkCard
        state={{ ...base, forcedByEnv: true, bound: '0.0.0.0' }}
        onToggle={noop}
        busy={false}
      />,
    );
    expect(container.textContent).toContain('這顆開關暫時沒有作用');
    expect(sw(container).disabled, '環境變數蓋過設定時開關竟然還按得動').toBe(true);
  });

  it('讀不到狀態時開關不可按（不要讓人以為改了）', () => {
    const { container } = render(<NetworkCard state={undefined} onToggle={noop} busy={false} />);
    expect(sw(container).disabled).toBe(true);
  });

  it('存檔中不可按（避免連點兩次送出相反的值）', () => {
    const { container } = render(<NetworkCard state={base} onToggle={noop} busy={true} />);
    expect(sw(container).disabled).toBe(true);
  });

  it('按下去會把新的值傳出來', () => {
    const onToggle = vi.fn();
    const { container } = render(<NetworkCard state={base} onToggle={onToggle} busy={false} />);
    fireEvent.click(sw(container));
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});

/**
 * 🔴 Peter 2026-08-27：「在沒有開啟 Tailscale 時被連線的話，要顯示正確的錯誤訊息、
 * 提示流程及警告。」
 *
 * 🔴 **最容易被誤會的不是「一條網址都沒有」，是「有網址、但那條是區網」** ——
 * 畫面上有東西可以抄，使用者不會發現抄到的是同一個 wifi 的人都連得到的那一條。
 * 舊版只在 `urls.length === 0` 時才說話，這個狀態它完全靜音。
 */
describe('Tailscale 沒在跑', () => {
  const live = { ...base, enabled: true, bound: '0.0.0.0' };

  it('🔴 有區網位址但沒有 Tailscale 那一條 ⇒ 要說出「找不到 Tailscale」並給步驟', () => {
    const { container } = render(
      <NetworkCard
        state={{ ...live, urls: [{ kind: 'lan', url: 'http://192.168.86.31:8520' }] }}
        onToggle={noop}
        busy={false}
      />,
    );
    expect(container.textContent).toContain('找不到 Tailscale 位址');
    expect(container.textContent).toContain('開頭是 100.');
  });

  it('有 Tailscale 那一條就不要嘮叨', () => {
    const { container } = render(
      <NetworkCard
        state={{
          ...live,
          urls: [
            { kind: 'tailscale', url: 'http://100.89.95.93:8520' },
            { kind: 'lan', url: 'http://192.168.86.31:8520' },
          ],
        }}
        onToggle={noop}
        busy={false}
      />,
    );
    expect(container.textContent).not.toContain('找不到 Tailscale 位址');
    // 尺沒壞的證明：同一份文案在上一條測試裡找得到
    expect(container.textContent).toContain('100.89.95.93');
  });

  it('還沒開放時不要先講 —— 那時候根本沒有人連得進來', () => {
    const { container } = render(<NetworkCard state={base} onToggle={noop} busy={false} />);
    expect(container.textContent).not.toContain('找不到 Tailscale 位址');
  });
});
