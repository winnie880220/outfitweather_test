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
  get geminiApiKey2() {
    return process.env.GEMINI_API_KEY_2?.trim() ?? "";
  },
  get geminiApiKeys() {
    return [env.geminiApiKey, env.geminiApiKey2].filter(Boolean);
  },
  /** Google Maps Platform — Weather API（與 Gemini 金鑰可相同專案） */
  get googleWeatherApiKey() {
    return (
      process.env.GOOGLE_WEATHER_API_KEY?.trim() ??
      process.env.GOOGLE_MAPS_API_KEY?.trim() ??
      process.env.googleWeatherApiKey?.trim() ??
      ""
    );
  },
};

export const getNotionDatabaseId = () => env.notionDatabaseId;

export const isNotionConfigured = () =>
  Boolean(env.notionApiKey && env.notionDatabaseId);

export const isGeminiConfigured = () => env.geminiApiKeys.length > 0;

export const isGoogleWeatherConfigured = () => Boolean(env.googleWeatherApiKey);
