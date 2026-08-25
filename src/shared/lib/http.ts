/** 前端唯一的 HTTP 出口。feature 的 api.ts 只能走這裡。 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * 🔴 **回應不是 JSON 時，要說出真正的原因。**
 * 上一版無條件 `JSON.parse(text)` —— 後端回純文字 `404 Not Found` 時，
 * 使用者看到的是「Unexpected non-whitespace character after JSON at position 4」。
 * 那句話指向解析器，不指向病因（路由不存在）。debug 時完全是誤導。
 */
function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { __raw: text };
  }
}

function messageOf(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    if ('error' in body) return String((body as { error: unknown }).error);
    if ('__raw' in body) {
      const raw = String((body as { __raw: unknown }).__raw).trim().slice(0, 160);
      return `HTTP ${status}：${raw}`;
    }
  }
  return `HTTP ${status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = parseBody(await res.text());
  if (!res.ok) throw new ApiError(messageOf(body, res.status), res.status);
  if (body && typeof body === 'object' && '__raw' in body) {
    // 200 但回的不是 JSON —— 這也是壞的，不要讓它靜靜往下走
    throw new ApiError(`回應不是 JSON（HTTP ${res.status}）`, res.status);
  }
  return body as T;
}

export const get = <T>(path: string): Promise<T> => request<T>(path);
export const post = <T>(path: string, data: unknown): Promise<T> =>
  request<T>(path, { method: 'POST', body: JSON.stringify(data) });
