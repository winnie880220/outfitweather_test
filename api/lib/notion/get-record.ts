import type { ApiResponse } from "../types";
import { notionRequest } from "./client";
import { parseNotionPage, type NotionProp } from "./parse-page";
import { hydrateRecordPhotoUrls } from "./resolve-photo";

export type OutfitRecordSnapshot = {
  pageId: string;
  photoUrl?: string;
  locationName?: string;
  temp?: number;
  weather?: string;
  recordedTime?: string;
};

type PageResponse = {
  id: string;
  properties: Record<string, NotionProp>;
};

/** 依 page id 讀取單筆穿搭紀錄（供待回饋還原） */
export async function getRecordByPageId(
  pageId: string
): Promise<ApiResponse<OutfitRecordSnapshot>> {
  const trimmed = pageId.trim();
  if (!trimmed || trimmed.startsWith("local-")) {
    return { ok: false, error: "無效的 page id" };
  }

  try {
    const page = await notionRequest<PageResponse>(`/pages/${trimmed}`, {
      method: "GET",
    });
    const parsed = parseNotionPage({ id: page.id, properties: page.properties });
    if (!parsed) {
      return { ok: false, error: "找不到穿搭紀錄" };
    }
    await hydrateRecordPhotoUrls([parsed]);

    let recordedTime: string | undefined;
    if (parsed.startedAt) {
      const d = new Date(parsed.startedAt);
      if (!Number.isNaN(d.getTime())) {
        recordedTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
    }

    return {
      ok: true,
      data: {
        pageId: parsed.id,
        photoUrl: parsed.photoUrl,
        locationName: parsed.location || undefined,
        temp: parsed.temperature,
        weather: parsed.weather,
        recordedTime,
      },
      source: "notion",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取紀錄失敗";
    return { ok: false, error: message };
  }
}
