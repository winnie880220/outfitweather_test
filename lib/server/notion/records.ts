import { Client } from "@notionhq/client";
import type { ApiResponse, NotionRecordPayload } from "../../../src/types/api";
import { env, getNotionDatabaseId, isNotionConfigured } from "../env";
import { toNotionProperties } from "./properties";

function getClient() {
  return new Client({ auth: env.notionApiKey });
}

/** POST /api/notion/records — 完成記錄時建立一筆（天氣 + 使用者） */
export async function createRecordInNotion(
  payload: NotionRecordPayload
): Promise<ApiResponse<{ id: string }>> {
  if (!isNotionConfigured()) {
    return {
      ok: true,
      data: { id: `local-${Date.now()}` },
      source: "mock",
      error: "NOTION_API_KEY 或 NOTION_DATABASE_ID 尚未設定",
    };
  }

  if (!payload.userName?.trim()) {
    return { ok: false, error: "缺少 userName" };
  }

  try {
    const notion = getClient();
    const page = await notion.pages.create({
      parent: { database_id: getNotionDatabaseId() },
      properties: toNotionProperties(payload) as Parameters<Client["pages"]["create"]>[0]["properties"],
    });

    return { ok: true, data: { id: page.id }, source: "notion" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notion 建立失敗";
    return { ok: false, error: message };
  }
}

/** PATCH /api/notion/records — 提交體感時更新同一筆 */
export async function updateRecordInNotion(
  pageId: string,
  payload: NotionRecordPayload
): Promise<ApiResponse<{ id: string }>> {
  if (!isNotionConfigured()) {
    return {
      ok: true,
      data: { id: pageId },
      source: "mock",
      error: "Notion 未設定",
    };
  }

  if (!pageId || pageId.startsWith("local-")) {
    return { ok: false, error: "無效的 Notion page id" };
  }

  try {
    const notion = getClient();
    await notion.pages.update({
      page_id: pageId,
      properties: toNotionProperties(payload) as Parameters<Client["pages"]["update"]>[0]["properties"],
    });

    return { ok: true, data: { id: pageId }, source: "notion" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notion 更新失敗";
    return { ok: false, error: message };
  }
}
