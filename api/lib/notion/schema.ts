export const RECORDS_DB = {
  userName: "userName",
  gender: "Gender",
  location: "Location",
  startedAt: "Started At",
  weather: "Weather",
  temperature: "Temperature",
  maxTemp: "Max Temp",
  minTemp: "Min Temp",
  /** Notion 類型：Number */
  apparentTemp: "Apparent Temp",
  humidity: "Humidity",
  rainProb: "Rain Prob",
  uvIndex: "UV Index",
  photo: "Photo",
  upperBodyTags: "Upper Body Tags",
  lowerBodyTags: "Lower Body Tags",
  /** Multi-select，AI 辨識之服裝主色（Notion 欄名須為 color） */
  color: "color",
  breathability: "Breathability",
  wrapping: "Wrapping",
  stuffiness: "Stuffiness",
  /** 使用者文字回饋（穿搭感受） */
  feedback: "feedback",
  /**
   * 記錄當下定位區域、此天氣溫度區間的顏色排行第一（研究：地圖是否影響選色）
   * Notion 類型：Multi-select（選項與 color 一致，通常只存一個排行第一色）
   */
  currentRanking: "CurrentRanking",
  /** 穿搭紀錄的唯一識別（每列的 ID 欄位） */
  recordId: "ID",
  /**
   * Multi-select（寫在收藏者 active 列上）：
   * 選項 = 被收藏穿搭的 ID 欄位值
   */
  favorite: "Favorite",
} as const;
