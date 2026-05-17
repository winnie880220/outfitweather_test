export const env = {
  notionApiKey: process.env.NOTION_API_KEY ?? "",
  notionDatabaseId:
    process.env.NOTION_DATABASE_ID ??
    process.env.NOTION_DATABASE_ID_OUTFITS ??
    "",
};

export const getNotionDatabaseId = () => env.notionDatabaseId;

export const isNotionConfigured = () =>
  Boolean(env.notionApiKey && env.notionDatabaseId);
