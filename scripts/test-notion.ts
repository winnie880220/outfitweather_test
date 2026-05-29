/**
 * Notion 串接測試腳本
 * 使用方式：在 .env.local 填入 NOTION_API_KEY、NOTION_DATABASE_ID 後執行 pnpm test:notion
 */
import "./load-env";

import { isNotionConfigured } from "../api/lib/env";
import { createRecordInNotion, updateRecordInNotion } from "../api/lib/notion/records";

async function main() {
  console.log("── 衣氣象 Notion 測試 ──\n");

  if (!isNotionConfigured()) {
    console.log("❌ 未設定環境變數");
    console.log("   請建立 .env.local 並填入 NOTION_API_KEY、NOTION_DATABASE_ID");
    process.exit(1);
  }

  console.log("✓ 環境變數已讀取");

  const sample = {
    userName: "API測試",
    location: "台北市",
    startedAt: new Date().toISOString(),
    weather: "多雲",
    temperature: 26,
    apparentTemp: 27,
    humidity: 72,
    rainProb: 30,
    uvIndex: 5,
  };

  console.log("\n1/2 POST 建立紀錄...");
  const created = await createRecordInNotion(sample);
  console.log(JSON.stringify(created, null, 2));

  if (!created.ok || !created.data?.id) {
    console.log("\n❌ 建立失敗");
    process.exit(1);
  }

  if (created.source !== "notion") {
    console.log("\n⚠️  仍為 mock 模式");
    process.exit(1);
  }

  console.log("\n2/2 PATCH 更新體感...");
  const updated = await updateRecordInNotion(created.data.id, {
    breathability: 60,
    wrapping: 50,
    stuffiness: 40,
  });
  console.log(JSON.stringify(updated, null, 2));

  if (updated.ok && updated.source === "notion") {
    console.log("\n✅ 串接成功！");
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌", err);
  process.exit(1);
});
