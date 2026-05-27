import type { ApiResponse, NotionRecordPayload } from "../types";
import { getNotionDatabaseId, isNotionConfigured } from "../env";
import { notionRequest } from "./client";
import { getRegionTopColorForLocation } from "./outfit-insights";
import { toNotionProperties } from "./properties";
import { uploadImageToNotion } from "./upload-photo";

function rankingDeltaFromPayload(payload: NotionRecordPayload): 1 | 2 {
  const min = payload.minTemp;
  const max = payload.maxTemp;
  if (
    typeof min !== "number" ||
    Number.isNaN(min) ||
    typeof max !== "number" ||
    Number.isNaN(max)
  ) {
    return 1;
  }
  return Math.abs(max - min) >= 8 ? 2 : 1;
}

/** 寫入 CurrentRanking：該區在此氣溫下顏色排行第一 */
async function withCurrentRanking(
  payload: NotionRecordPayload
): Promise<NotionRecordPayload> {
  if (payload.currentRanking?.trim()) return payload;
  if (!payload.location?.trim() || payload.temperature === undefined) return payload;

  try {
    const delta = rankingDeltaFromPayload(payload);
    const top = await getRegionTopColorForLocation(
      payload.temperature,
      payload.location,
      delta
    );
    if (top) return { ...payload, currentRanking: top };
  } catch (error) {
    console.warn("[notion] CurrentRanking:", error);
  }
  return payload;
}

/** 將 photoBase64 上傳至 Notion，回傳可寫入 properties 的 payload */
async function attachPhotoToPayload(
  payload: NotionRecordPayload
): Promise<{ notionPayload: NotionRecordPayload; photoWarning?: string }> {
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
  return { notionPayload, photoWarning };
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
    const enriched = await withCurrentRanking(payload);
    const { notionPayload, photoWarning } = await attachPhotoToPayload(enriched);

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
    const { notionPayload, photoWarning } = await attachPhotoToPayload(payload);

    await notionRequest(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: toNotionProperties(notionPayload),
      }),
    });

    return {
      ok: true,
      data: { id: pageId },
      source: "notion",
      ...(photoWarning ? { error: `照片未寫入：${photoWarning}` } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notion 更新失敗";
    return { ok: false, error: message };
  }
}
