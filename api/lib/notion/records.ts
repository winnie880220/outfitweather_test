import type { ApiResponse, NotionRecordPayload } from "../types";
import { getNotionDatabaseId, isNotionConfigured } from "../env";
import { notionRequest } from "./client";
import { toNotionProperties } from "./properties";
import { uploadImageToNotion } from "./upload-photo";

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

    let photoWarning: string | undefined;
    if (payload.photoBase64) {
      try {
        notionPayload.photoFileUploadId = await uploadImageToNotion(
          payload.photoBase64,
          payload.photoMimeType ?? "image/jpeg"
        );
      } catch (uploadError) {
        photoWarning =
          uploadError instanceof Error
            ? uploadError.message
            : "照片上傳失敗，已略過 Photo 欄位";
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

    return {
      ok: true,
      data: { id: page.id },
      source: "notion",
      ...(photoWarning ? { error: `照片未寫入：${photoWarning}` } : {}),
    };
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
