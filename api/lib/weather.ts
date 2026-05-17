import type { WeatherData } from "./types";
import { reverseGeocode } from "./geocode";

const getWeatherCondition = (code: number): string => {
  const mapping: Record<number, string> = {
    0: "晴朗",
    1: "晴間多雲",
    2: "多雲",
    3: "陰天",
    45: "霧",
    48: "霧",
    51: "毛毛雨",
    53: "毛毛雨",
    55: "毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    80: "陣雨",
    81: "強陣雨",
    82: "暴力雨",
    95: "雷雨",
  };
  return mapping[code] || "未知氣候";
};

export async function getCurrentWeather(
  lat: number,
  lon: number,
  displayName?: string
): Promise<WeatherData> {
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,precipitation_probability,apparent_temperature,uv_index`
  );

  if (!weatherRes.ok) {
    throw new Error("天氣服務暫時無法使用");
  }

  const weatherData = await weatherRes.json();
  const current = weatherData.current_weather;
  const hourIdx = new Date().getHours();

  let locationName = displayName?.trim() || "";
  if (!locationName) {
    locationName = await reverseGeocode(lat, lon);
  }

  return {
    temp: current.temperature,
    condition: getWeatherCondition(current.weathercode),
    conditionCode: current.weathercode,
    humidity: weatherData.hourly.relativehumidity_2m[hourIdx],
    rainProb: weatherData.hourly.precipitation_probability[hourIdx],
    apparentTemp: weatherData.hourly.apparent_temperature[hourIdx],
    uvIndex: weatherData.hourly.uv_index[hourIdx],
    locationName,
  };
}
