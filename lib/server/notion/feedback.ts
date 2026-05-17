import type { ApiResponse, CreateFeedbackPayload } from "../../../src/types/api";
import { env, isNotionFeedbackConfigured } from "../env";

/**
 * POST /api/notion/feedback
 * 之後寫入 Notion 體感回饋 Database
 */
export async function createFeedbackInNotion(
  payload: CreateFeedbackPayload
): Promise<ApiResponse<{ id: string }>> {
  if (!isNotionFeedbackConfigured()) {
    return {
      ok: true,
      data: { id: `local-${Date.now()}` },
      source: "mock",
      error: "NOTION_DATABASE_ID_FEEDBACK 尚未設定",
    };
  }

  void payload;
  void env.notionApiKey;
  // TODO: pages.create({ parent: { database_id: env.notionDatabaseFeedback }, ... })
  return {
    ok: false,
    error: "Notion 體感回饋尚未實作，請在 lib/server/notion/feedback.ts 完成",
  };
}
