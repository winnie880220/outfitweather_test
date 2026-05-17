/** Vercel Serverless 環境變數（僅在 api/ 與 lib/server 使用） */

export const env = {
  notionApiKey: process.env.NOTION_API_KEY ?? "",
  /** 單一穿搭+體感資料庫（優先使用 NOTION_DATABASE_ID） */
  notionDatabaseId:
    process.env.NOTION_DATABASE_ID ??
    process.env.NOTION_DATABASE_ID_OUTFITS ??
    "",
};

export const getNotionDatabaseId = () => env.notionDatabaseId;

export const isNotionConfigured = () =>
  Boolean(env.notionApiKey && env.notionDatabaseId);
