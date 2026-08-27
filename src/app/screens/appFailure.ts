import { ApiError } from '@/shared/lib/http';

/** 一次「整頁打不開」要對使用者說的三件事。 */
export type AppFailure = {
  /** 發生什麼事。**一句人話**，不是 `Something went wrong`。 */
  title: string;
  /** 現在該做什麼。給不出可靠的下一步就留空 —— 亂猜的建議比沉默更浪費時間。 */
  what: string;
  /** 🔴 **原文一定要留。** 猜錯病因而把上游的訊息丟掉，比多幾個括號糟得多。 */
  detail: string;
  /** 「再試一次」有沒有意義。連不上／後端沒回應有；被拒絕、找不到沒有。 */
  retryable: boolean;
};

/**
 * 把一個丟出來的例外翻成畫面上該說的話。
 *
 * 🔴 **這支存在的理由**：Peter 2026-08-27 用手機透過 Tailscale 連進來，整頁只有
 * 「Something went wrong! ／ HTTP 502」——那是 TanStack Router 的預設錯誤元件，
 * 而 502 的真正意思很具體：**畫面（vite）活著，但它轉不到後端**。
 * 使用者要知道的是「後端沒在跑」，不是一個三位數。
 *
 * 🔴 **502／503／504 要跟 500 分開講。** 500 是後端自己出錯（它有在跑），
 * 502 是根本沒接到人 —— 兩者的下一步完全不同（看 log vs 把後端開起來）。
 *
 * ⚠️ `fetch` 連不上時丟的是 `TypeError`，訊息是瀏覽器各自的英文
 *（`Failed to fetch`／`Load failed`）——那句話對使用者沒有意義，但**照樣要留在原文裡**。
 */
export function describeFailure(e: unknown): AppFailure {
  if (e instanceof ApiError) return ofApi(e);
  if (e instanceof TypeError)
    return {
      title: '連不上 Vellum',
      what: '電腦可能睡著了、或是 Tailscale／區網斷了。確認那台電腦醒著、Vellum 還開著，再按「再試一次」。',
      detail: e.message || String(e),
      retryable: true,
    };
  if (e instanceof Error)
    return { title: '出了點問題', what: '', detail: e.message || String(e), retryable: true };
  return { title: '出了點問題', what: '', detail: String(e), retryable: true };
}

function ofApi(e: ApiError): AppFailure {
  const detail = e.message;
  if (e.status === 502 || e.status === 503 || e.status === 504)
    return {
      title: 'Vellum 的後端沒有回應',
      // 🔴 講的是**這個部署形狀真正會發生的事**：畫面由 vite 端出來，資料要再轉一手給後端。
      what: '畫面載得起來，但後端沒在跑（或剛剛掛掉）。把後端重新啟動之後按「再試一次」。',
      detail,
      retryable: true,
    };
  if (e.status >= 500)
    return {
      title: 'Vellum 的後端出錯了',
      what: '後端有在跑，是它自己出了錯。原文在下面，複製給我們就查得到。',
      detail,
      retryable: true,
    };
  if (e.status === 404)
    return { title: '找不到這個東西', what: '它可能已經被刪掉了。', detail, retryable: false };
  if (e.status === 401 || e.status === 403)
    return { title: '沒有權限', what: '', detail, retryable: false };
  return { title: '這個要求沒有被接受', what: '', detail, retryable: false };
}
