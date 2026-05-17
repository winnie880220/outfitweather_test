import type { ApiResponse, OutfitRecord } from "../../../src/types/api";
import { env, isNotionConfigured } from "../env";

/**
 * GET /api/notion/inspiration
 * 之後從 Notion 讀取「今日靈感」卡片（可獨立 DB 或與穿搭共用）
 */
export async function listInspirationFromNotion(): Promise<ApiResponse<OutfitRecord[]>> {
  const dbId = env.notionDatabaseInspiration || env.notionDatabaseOutfits;

  if (!env.notionApiKey || !dbId) {
    return {
      ok: true,
      data: [],
      source: "mock",
      error: "NOTION_DATABASE_ID_INSPIRATION 尚未設定",
    };
  }

  void dbId;
  // TODO: 查詢靈感資料庫
  return {
    ok: false,
    error: "Notion 靈感資料尚未實作，請在 lib/server/notion/inspiration.ts 完成",
  };
}
