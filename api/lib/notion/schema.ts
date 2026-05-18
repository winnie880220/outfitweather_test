export const RECORDS_DB = {
  userName: "userName",
  gender: "Gender",
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
  /** 穿搭紀錄的唯一識別（每列的 ID 欄位） */
  recordId: "ID",
  /**
   * Multi-select（寫在收藏者 active 列上）：
   * 選項 = 被收藏穿搭的 ID 欄位值
   */
  favorite: "Favorite",
} as const;
