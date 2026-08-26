import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchPersonas, type PersonaLayer as Layer, setChatPersona } from '../api';
import { PersonaLayer } from './PersonaLayer';

/**
 * 對話畫面的「我是誰」。**把資料取得與切換包在一起**，
 * 讓對話那一頁只需要知道「有這個東西」，不必知道 persona 有三層。
 *
 * 🔴 **2026-08-26 起它是 ☰ 裡的一個全螢層，不再是頂欄上的按鈕**（Peter 裁定「3 收進去」）。
 */
export function ChatPersona({
  chatId,
  persona,
  onChanged,
  open,
  onClose,
}: {
  chatId: string;
  persona?: { id?: string | undefined; name?: string | undefined; layer: string } | undefined;
  /** 🔴 換完要讓對話重讀 —— `{{user}}` 的展開結果會跟著變。 */
  onChanged: () => void;
  open: boolean;
  onClose: () => void;
}) {
  const list = useQuery({ queryKey: ['personas'], queryFn: fetchPersonas, enabled: open });
  const pick = useMutation({
    mutationFn: (personaId: string | null) => setChatPersona(chatId, personaId),
    onSuccess: onChanged,
  });

  return (
    <PersonaLayer
      open={open}
      onClose={onClose}
      current={persona?.id ? { id: persona.id, name: persona.name } : null}
      layer={(persona?.layer ?? 'none') as Layer}
      personas={list.data?.personas ?? []}
      onPick={(id) => pick.mutate(id)}
    />
  );
}
