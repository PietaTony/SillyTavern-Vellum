import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type DeletePersonaResult, deletePersona, type Persona } from '../api';
import { DeletePersonaSection } from '../ui/DeletePersonaSection';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, deletePersona: vi.fn() };
});

const PERSONA: Persona = {
  id: 'p1',
  name: '小美',
  avatar: '',
  description: '',
  position: 'in_prompt',
  depth: 4,
  role: 0,
  title: '',
  archived: false,
  createdAt: '2026-08-26T00:00:00.000Z',
};

/**
 * 🔴 這支**故意不直接掛 `DeletePersonaDialog`**——那樣測不到
 * `DeletePersonaSection` 自己的包裝邏輯（`{id,name}` 快照 state）。
 * `Harness` 模擬 `/profile` 的真實行為：`onResult` 觸發 `personas` query
 * 重新抓，讓 `persona` 這個 prop 變成 `null`——這正是 bug ② 存在的情境。
 */
function Harness({ onResult }: { onResult?: ((r: DeletePersonaResult) => void) | undefined }) {
  const [persona, setPersona] = useState<Persona | null>(PERSONA);
  return (
    <>
      {/* 讓測試看得到 `persona` prop 目前的值，證明「已經變成 null」這件事真的發生了。 */}
      <div data-testid="persona-state">{persona ? persona.name : '（已清空）'}</div>
      <DeletePersonaSection
        persona={persona}
        onResult={(r) => {
          setPersona(null);
          onResult?.(r);
        }}
      />
    </>
  );
}

const renderHarness = (onResult?: (r: DeletePersonaResult) => void) => {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <Harness onResult={onResult} />
    </QueryClientProvider>,
  );
};

/**
 * 🔴 守的是回報裡自己找到、自己修的 bug ②：`DeletePersonaSection` 若寫成
 * `{persona && <DeletePersonaDialog/>}`，`onResult` 一旦把 `persona` 變成
 * `null`，對話框會跟著被卸載——使用者連「改成封存了」那句解釋都看不到。
 * `deletePersonaDialog.test.tsx` 直接掛 `DeletePersonaDialog` 本身、`personaId`
 * 寫死，測不到這條「上層 prop 消失」的路，所以另開這支走 `DeletePersonaSection`。
 */
describe('DeletePersonaSection（走包裝邏輯，不是直接掛 Dialog）', () => {
  afterEach(() => vi.mocked(deletePersona).mockReset());

  it('沒有 persona 就不畫刪除鈕', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DeletePersonaSection persona={null} onResult={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(screen.queryByText('刪除這個 persona')).toBeNull();
  });

  it('🔴 封存結果出來、上層 persona 變成 null 之後，對話框仍然在、說明文字仍然讀得到', async () => {
    const result: DeletePersonaResult = {
      removed: false,
      archived: true,
      refs: { chats: 0, friends: 0, isDefault: true },
    };
    vi.mocked(deletePersona).mockResolvedValue(result);
    renderHarness();

    fireEvent.click(screen.getByText('刪除這個 persona'));
    fireEvent.click(screen.getByText('刪除'));

    // 先確認上層真的把 persona 變成 null 了（不是測試沒模擬到）。
    await waitFor(() => expect(screen.getByTestId('persona-state').textContent).toBe('（已清空）'));

    // 🔴 這裡是這支測試存在的理由：persona 已經是 null，對話框要仍然在畫面上。
    expect(screen.getByText('改成封存了')).toBeTruthy();
    expect(screen.getByText(/它是目前的全域預設/)).toBeTruthy();
  });

  it('「知道了」關閉之後鈕才會照著新的 persona（null）狀態消失', async () => {
    const result: DeletePersonaResult = {
      removed: false,
      archived: true,
      refs: { chats: 0, friends: 0, isDefault: true },
    };
    vi.mocked(deletePersona).mockResolvedValue(result);
    renderHarness();

    fireEvent.click(screen.getByText('刪除這個 persona'));
    fireEvent.click(screen.getByText('刪除'));
    await waitFor(() => expect(screen.getByText('改成封存了')).toBeTruthy());

    fireEvent.click(screen.getByText('知道了'));
    expect(screen.queryByText('改成封存了')).toBeNull();
    expect(screen.queryByText('刪除這個 persona')).toBeNull();
  });
});
