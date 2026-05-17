/** 延遲讀取 process.env，避免 dotenv 尚未載入時就固定成空字串 */
export const env = {
  get notionApiKey() {
    return process.env.NOTION_API_KEY?.trim() ?? "";
  },
  get notionDatabaseId() {
    return (
      process.env.NOTION_DATABASE_ID?.trim() ??
      process.env.NOTION_DATABASE_ID_OUTFITS?.trim() ??
      ""
    );
  },
  get geminiApiKey() {
    return process.env.GEMINI_API_KEY?.trim() ?? "";
  },
};

export const getNotionDatabaseId = () => env.notionDatabaseId;

export const isNotionConfigured = () =>
  Boolean(env.notionApiKey && env.notionDatabaseId);

export const isGeminiConfigured = () => Boolean(env.geminiApiKey);
