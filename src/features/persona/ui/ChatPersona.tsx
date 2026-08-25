import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchPersonas, type PersonaLayer, setChatPersona } from '../api';
import { PersonaSwitcher } from './PersonaSwitcher';

/**
 * 對話畫面右上角的「我是誰」。**把資料取得與切換包在一起**，
 * 讓對話那一頁只需要知道「有這個東西」，不必知道 persona 有三層。
 */
export function ChatPersona({
  chatId,
  persona,
  onChanged,
}: {
  chatId: string;
  persona?: { id?: string | undefined; name?: string | undefined; layer: string } | undefined;
  /** 🔴 換完要讓對話重讀 —— `{{user}}` 的展開結果會跟著變。 */
  onChanged: () => void;
}) {
  const list = useQuery({ queryKey: ['personas'], queryFn: fetchPersonas });
  const pick = useMutation({
    mutationFn: (personaId: string | null) => setChatPersona(chatId, personaId),
    onSuccess: onChanged,
  });

  return (
    <PersonaSwitcher
      current={persona?.id ? { id: persona.id, name: persona.name } : null}
      layer={(persona?.layer ?? 'none') as PersonaLayer}
      personas={list.data?.personas ?? []}
      onPick={(id) => pick.mutate(id)}
    />
  );
}
