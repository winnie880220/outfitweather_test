/**
 * Notion 單一資料庫欄位（與你的 Notion 表頭完全一致，英文、區分大小寫）
 * 穿搭 + 天氣 + 體感合併在同一 Database
 *
 * 環境變數：NOTION_DATABASE_ID（或沿用 NOTION_DATABASE_ID_OUTFITS）
 */

export const RECORDS_DB = {
  userName: "userName",
  location: "Location",
  startedAt: "Started At",
  weather: "Weather",
  temperature: "Temperature",
  maxTemp: "Max Temp",
  minTemp: "Min Temp",
  apparentTemp: "Apparent Temp",
  humidity: "Humidity",
  rainProb: "Rain Prob",
  uvIndex: "UV Index",
  photo: "Photo",
  upperBodyTags: "Upper Body Tags",
  lowerBodyTags: "Lower Body Tags",
  breathability: "Breathability",
  wrapping: "Wrapping",
  stuffiness: "Stuffiness",
} as const;

/** Notion 屬性類型（建立欄位時參考） */
export const RECORDS_DB_TYPES = {
  [RECORDS_DB.userName]: "title",
  [RECORDS_DB.location]: "rich_text",
  [RECORDS_DB.startedAt]: "date",
  [RECORDS_DB.weather]: "select",
  [RECORDS_DB.temperature]: "number",
  [RECORDS_DB.maxTemp]: "rich_text",
  [RECORDS_DB.minTemp]: "number",
  [RECORDS_DB.apparentTemp]: "rich_text",
  [RECORDS_DB.humidity]: "number",
  [RECORDS_DB.rainProb]: "number",
  [RECORDS_DB.uvIndex]: "number",
  [RECORDS_DB.photo]: "files",
  [RECORDS_DB.upperBodyTags]: "multi_select",
  [RECORDS_DB.lowerBodyTags]: "multi_select",
  [RECORDS_DB.breathability]: "number",
  [RECORDS_DB.wrapping]: "number",
  [RECORDS_DB.stuffiness]: "number",
} as const;
