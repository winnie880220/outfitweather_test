/** 避開 Vercel/API 編譯時 fetch Response／RequestInit 與 Express／DOM 型別衝突 */
export type HttpRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string | FormData | Buffer | null;
};

export type HttpFetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export async function httpFetch(
  url: string,
  init?: HttpRequestInit
): Promise<HttpFetchResponse> {
  return (await fetch(url, init as globalThis.RequestInit)) as HttpFetchResponse;
}

export class HttpFetchError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpFetchError";
    this.status = status;
  }
}

export async function httpFetchJson<T>(
  url: string,
  init?: HttpRequestInit
): Promise<T> {
  const res = await httpFetch(url, init);
  if (!res.ok) {
    throw new HttpFetchError(`HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}
