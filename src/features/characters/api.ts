import { get, post } from '@/shared/lib/http';

export type Character = {
  id: string;
  name: string;
  description: string;
  firstMessage: string;
  avatar: string;
  createdAt: string;
};

export type NewCharacter = Omit<Character, 'id' | 'createdAt'>;

export const fetchCharacters = (): Promise<Character[]> => get<Character[]>('/api/characters');
export const createCharacter = (c: NewCharacter): Promise<Character> =>
  post<Character>('/api/characters', c);
