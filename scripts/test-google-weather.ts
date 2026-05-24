import "../scripts/load-env";

const key =
  process.env.GOOGLE_WEATHER_API_KEY?.trim() ||
  process.env.GOOGLE_MAPS_API_KEY?.trim() ||
  "";

console.log("GOOGLE_WEATHER_API_KEY 已設定:", Boolean(key));
if (key) console.log("金鑰長度:", key.length);

const lat = 25.033;
const lon = 121.565;

async function probe(name: string, url: string) {
  const res = await fetch(url);
  const text = await res.text();
  let detail = text.slice(0, 500);
  try {
    const j = JSON.parse(text) as { error?: { message?: string; status?: string } };
    if (j.error?.message) detail = j.error.message;
    if (j.error?.status) detail = `${j.error.status}: ${detail}`;
  } catch {
    /* raw text */
  }
  console.log(`\n--- ${name} ---`);
  console.log("HTTP", res.status, res.statusText);
  console.log(detail);
}

async function main() {
  if (!key) {
    console.log("\n未設定金鑰，專案會使用 Open-Meteo。");
    return;
  }

  const common = new URLSearchParams({
    key,
    "location.latitude": String(lat),
    "location.longitude": String(lon),
    languageCode: "zh-TW",
    unitsSystem: "METRIC",
  });

  await probe(
    "currentConditions:lookup",
    `https://weather.googleapis.com/v1/currentConditions:lookup?${common}`
  );

  const daily = new URLSearchParams(common);
  daily.set("days", "1");
  await probe(
    "forecast/days:lookup",
    `https://weather.googleapis.com/v1/forecast/days:lookup?${daily}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
