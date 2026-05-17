/** Vercel Serverless 環境變數（僅在 api/ 與 lib/server 使用） */

export const env = {
  notionApiKey: process.env.NOTION_API_KEY ?? "",
  notionDatabaseOutfits: process.env.NOTION_DATABASE_ID_OUTFITS ?? "",
  notionDatabaseFeedback: process.env.NOTION_DATABASE_ID_FEEDBACK ?? "",
  notionDatabaseInspiration: process.env.NOTION_DATABASE_ID_INSPIRATION ?? "",
};

export const isNotionConfigured = () =>
  Boolean(env.notionApiKey && env.notionDatabaseOutfits);

export const isNotionFeedbackConfigured = () =>
  Boolean(env.notionApiKey && env.notionDatabaseFeedback);
