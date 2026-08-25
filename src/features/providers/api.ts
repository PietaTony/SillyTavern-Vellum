import { get, post } from '@/shared/lib/http';

export type ProviderId = 'google' | 'anthropic';
export type KeyStatus = Record<ProviderId, boolean>;
export type TestResult =
  | { ok: true; models: string[] }
  | { ok: false; message: string; status?: number };

export const fetchKeyStatus = (): Promise<KeyStatus> => get<KeyStatus>('/api/secrets');

export const testKey = (provider: ProviderId, value: string): Promise<TestResult> =>
  post<TestResult>('/api/secrets/test', { provider, value });
