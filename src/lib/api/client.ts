import type { ApiResponse } from "../../types/api";

/**
 * API 基底路徑
 * - 本機 pnpm dev：走 Vite 開發中介層 /api（見 vite.config.ts）
 * - Vercel 部署：同網域 /api
 * - 若需指向其他 Vercel 專案：設定 VITE_API_BASE_URL
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: ApiResponse<T>;

  try {
    json = JSON.parse(text) as ApiResponse<T>;
  } catch {
    const preview = text.slice(0, 80).replace(/\s+/g, " ");
    throw new ApiError(
      preview.startsWith("A server")
        ? "伺服器暫時無法處理，請稍後再試"
        : `API 回應格式錯誤：${preview}`,
      res.status
    );
  }

  if (!res.ok || !json.ok) {
    throw new ApiError(json.error ?? `請求失敗 (${res.status})`, res.status);
  }
  if (json.data === undefined) {
    throw new ApiError("回應缺少 data", res.status);
  }
  return json.data;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  return parseResponse<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}
