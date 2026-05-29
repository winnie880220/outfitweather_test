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

/** 從卡片顯示字串（如 "28°C・晴"）解析溫度 */
export function parseInspirationCardTempLabel(temp: string): number | undefined {
  const m = temp.trim().match(/^(-?\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

export function inspirationCardReferenceTemp(card: {
  referenceTemp?: number;
  temp?: string;
}): number | undefined {
  if (
    typeof card.referenceTemp === "number" &&
    Number.isFinite(card.referenceTemp)
  ) {
    return card.referenceTemp;
  }
  if (typeof card.temp === "string") {
    return parseInspirationCardTempLabel(card.temp);
  }
  return undefined;
}

/** 卡片溫度是否落在靈感／收藏用的溫區內 */
export function cardMatchesInsightTempBand(
  card: { referenceTemp?: number; temp?: string },
  refTemp: number,
  delta: number
): boolean {
  const t = inspirationCardReferenceTemp(card);
  if (t == null) return false;
  const center = Math.round(refTemp);
  return t >= center - delta && t <= center + delta;
}
