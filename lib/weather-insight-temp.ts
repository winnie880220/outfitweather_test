/** 靈感牆／地圖排行／溫區篩選：以體感溫度為主，無則退回氣溫 */
export function weatherInsightReferenceTemp(weather: {
  temp: number;
  apparentTemp?: number;
}): number {
  if (
    typeof weather.apparentTemp === "number" &&
    Number.isFinite(weather.apparentTemp)
  ) {
    return weather.apparentTemp;
  }
  return weather.temp;
}

/** 從 Notion 紀錄讀取溫區比對用溫度（體感優先） */
export function recordInsightReferenceTemp(record: {
  apparentTemp?: number;
  temperature?: number;
}): number | undefined {
  if (
    typeof record.apparentTemp === "number" &&
    Number.isFinite(record.apparentTemp)
  ) {
    return record.apparentTemp;
  }
  if (
    typeof record.temperature === "number" &&
    Number.isFinite(record.temperature)
  ) {
    return record.temperature;
  }
  return undefined;
}
