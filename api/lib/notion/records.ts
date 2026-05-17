import type { ApiResponse, NotionRecordPayload } from "../types";
import { env, getNotionDatabaseId, isNotionConfigured } from "../env";
import { toNotionProperties } from "./properties";
import { uploadImageToNotion } from "./upload-photo";

const NOTION_VERSION = "2022-06-28";

async function notionRequest<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.notionApiKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const data = (await res.json()) as T & { message?: string };
  if (!res.ok) {
    const message =
      typeof data === "object" && data && "message" in data && data.message
        ? String(data.message)
        : `Notion API ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export async function createRecordInNotion(
  payload: NotionRecordPayload
): Promise<ApiResponse<{ id: string }>> {
  if (!isNotionConfigured()) {
    return {
      ok: false,
      error: "NOTION_API_KEY 或 NOTION_DATABASE_ID 尚未在 Vercel 設定",
    };
  }

  if (!payload.userName?.trim()) {
    return { ok: false, error: "缺少 userName" };
  }

  try {
    const notionPayload: NotionRecordPayload = { ...payload };

    if (payload.photoBase64) {
      try {
        notionPayload.photoFileUploadId = await uploadImageToNotion(
          payload.photoBase64,
          payload.photoMimeType ?? "image/jpeg"
        );
      } catch (uploadError) {
        const msg =
          uploadError instanceof Error ? uploadError.message : "照片上傳失敗";
        return { ok: false, error: `Notion 照片：${msg}` };
      }
    }

    delete notionPayload.photoBase64;
    delete notionPayload.photoMimeType;

    const page = await notionRequest<{ id: string }>("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: getNotionDatabaseId() },
        properties: toNotionProperties(notionPayload),
      }),
    });

    return { ok: true, data: { id: page.id }, source: "notion" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notion 建立失敗";
    return { ok: false, error: message };
  }
}

export async function updateRecordInNotion(
  pageId: string,
  payload: NotionRecordPayload
): Promise<ApiResponse<{ id: string }>> {
  if (!isNotionConfigured()) {
    return {
      ok: false,
      error: "NOTION_API_KEY 或 NOTION_DATABASE_ID 尚未在 Vercel 設定",
    };
  }

  if (!pageId || pageId.startsWith("local-")) {
    return { ok: false, error: "無效的 Notion page id" };
  }

  try {
    await notionRequest(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: toNotionProperties(payload),
      }),
    });

    return { ok: true, data: { id: pageId }, source: "notion" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notion 更新失敗";
    return { ok: false, error: message };
  }
}
