import type { ApiResponse, CreateOutfitPayload, OutfitRecord } from "../../../src/types/api";
import { env, isNotionConfigured } from "../env";

/**
 * GET /api/notion/outfits
 * 之後從 Notion Database 讀取穿搭／衣櫥紀錄
 */
export async function listOutfitsFromNotion(): Promise<ApiResponse<OutfitRecord[]>> {
  if (!isNotionConfigured()) {
    return {
      ok: true,
      data: [],
      source: "mock",
      error: "NOTION_API_KEY 或 NOTION_DATABASE_ID_OUTFITS 尚未設定",
    };
  }

  // TODO: 使用 @notionhq/client 查詢 env.notionDatabaseOutfits
  void env.notionApiKey;
  return {
    ok: false,
    error: "Notion 穿搭資料庫串接尚未實作，請在 lib/server/notion/outfits.ts 完成",
  };
}

/**
 * POST /api/notion/outfits
 * 之後寫入 Notion Database
 */
export async function createOutfitInNotion(
  payload: CreateOutfitPayload
): Promise<ApiResponse<{ id: string }>> {
  if (!isNotionConfigured()) {
    return {
      ok: true,
      data: { id: `local-${Date.now()}` },
      source: "mock",
      error: "Notion 未設定，僅回傳本地暫存 ID",
    };
  }

  void payload;
  // TODO: pages.create({ parent: { database_id: env.notionDatabaseOutfits }, properties: ... })
  return {
    ok: false,
    error: "Notion 新增穿搭尚未實作，請在 lib/server/notion/outfits.ts 完成",
  };
}
