import type { WeatherData } from "../../types/api";
import { reverseGeocode } from "./geocode";
import { apiGet } from "./client";

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

async function fetchWeatherDirect(
  lat: number,
  lon: number,
  displayName?: string
): Promise<WeatherData> {
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=1&current_weather=true&hourly=temperature_2m,relativehumidity_2m,precipitation_probability,apparent_temperature,uv_index&daily=temperature_2m_max,temperature_2m_min`
  );
  if (!weatherRes.ok) throw new Error("天氣服務暫時無法使用");

  const weatherData = (await weatherRes.json()) as {
    current_weather: { temperature: number; weathercode: number };
    hourly: {
      relativehumidity_2m: number[];
      precipitation_probability: number[];
      apparent_temperature: number[];
      uv_index: number[];
    };
    daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
  };
  const current = weatherData.current_weather;
  const hourIdx = new Date().getHours();
  const hourlyAt = (series: number[]) => {
    const val = series[hourIdx] ?? series[0];
    return typeof val === "number" && !Number.isNaN(val) ? val : 0;
  };

  let locationName = displayName?.trim() || "";
  if (!locationName) {
    locationName = await reverseGeocode(lat, lon);
  }

  const dailyMax = weatherData.daily?.temperature_2m_max?.[0];
  const dailyMin = weatherData.daily?.temperature_2m_min?.[0];

  return {
    temp: current.temperature,
    ...(typeof dailyMin === "number" && !Number.isNaN(dailyMin) ? { tempMin: dailyMin } : {}),
    ...(typeof dailyMax === "number" && !Number.isNaN(dailyMax) ? { tempMax: dailyMax } : {}),
    condition: getWeatherCondition(current.weathercode),
    conditionCode: current.weathercode,
    humidity: hourlyAt(weatherData.hourly.relativehumidity_2m),
    rainProb: hourlyAt(weatherData.hourly.precipitation_probability),
    apparentTemp: hourlyAt(weatherData.hourly.apparent_temperature),
    uvIndex: hourlyAt(weatherData.hourly.uv_index),
    locationName,
  };
}

/** GET /api/weather（失敗時改直接呼叫 Open-Meteo） */
export async function fetchCurrentWeather(
  lat: number,
  lon: number,
  displayName?: string
): Promise<WeatherData> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
    });
    if (displayName?.trim()) {
      params.set("name", displayName.trim());
    }
    return await apiGet<WeatherData>(`/api/weather?${params}`);
  } catch {
    return fetchWeatherDirect(lat, lon, displayName);
  }
}
