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
      const raw = String((body as { __raw: unknown }).__raw)
        .trim()
        .slice(0, 160);
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

export const patch = <T>(path: string, data: unknown): Promise<T> =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(data) });

export const put = <T>(path: string, data: unknown): Promise<T> =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(data) });

/**
 * 傳原始位元組（角色卡是 PNG）。
 * 🔴 **不要包成 base64 JSON**：會膨脹 ~33%，一張 6.8 MB 的卡變 9 MB，直接撞上 body 上限。
 */
export const postBytes = <T>(path: string, bytes: ArrayBuffer): Promise<T> =>
  request<T>(path, {
    method: 'POST',
    body: bytes,
    headers: { 'Content-Type': 'application/octet-stream' },
  });

export const del = <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' });

/**
 * 跟 `postBytes` 一樣傳原始位元組，但用 `XMLHttpRequest` 換 `fetch` ——
 * 🔴 **`fetch` 沒有上傳進度 API**，只有 `XMLHttpRequest.upload.onprogress` 有。
 * 角色卡可以到 6.8 MB，這幾秒使用者要看到百分比而不是乾等一個 spinner。
 *
 * ⚠️ **`lengthComputable` 可能是 false**（少數環境／中介層會拿掉 `Content-Length`）——
 * 這時 `onProgress` 收到 `null`，呼叫端要退回不定量的 spinner，
 * **不要顯示一個永遠停在 0% 的進度條**。
 */
export const postBytesWithProgress = <T>(
  path: string,
  bytes: ArrayBuffer,
  onProgress: (fraction: number | null) => void,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', path);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => onProgress(e.lengthComputable ? e.loaded / e.total : null);
    xhr.onload = () => {
      const body = parseBody(xhr.responseText);
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError(messageOf(body, xhr.status), xhr.status));
      } else if (body && typeof body === 'object' && '__raw' in body) {
        reject(new ApiError(`回應不是 JSON（HTTP ${xhr.status}）`, xhr.status));
      } else {
        resolve(body as T);
      }
    };
    xhr.onerror = () => reject(new ApiError('網路錯誤', 0));
    xhr.send(bytes);
  });

/**
 * 傳表單（背景圖上傳）。
 * 🔴 **不可以自己設 `Content-Type`** —— `multipart/form-data` 必須帶 `boundary`，
 * 那個值只有瀏覽器知道。手寫一個沒有 boundary 的 header，後端會解析出 0 個欄位，
 * 然後回「沒有收到檔案」——看起來像前端沒送，實際上是 header 蓋掉了。
 * ⇒ 這裡刻意繞過 `request()`（它無條件塞 JSON header）。
 */
export async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(path, { method: 'POST', body: form });
  const body = parseBody(await res.text());
  if (!res.ok) throw new ApiError(messageOf(body, res.status), res.status);
  return body as T;
}
