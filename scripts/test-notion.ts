/**
 * Notion 串接測試腳本
 * 使用方式：
 *   1. 複製 .env.example → .env.local，填入 NOTION_API_KEY、NOTION_DATABASE_ID
 *   2. pnpm test:notion
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

import { isNotionConfigured } from "../lib/server/env";
import { createRecordInNotion, updateRecordInNotion } from "../lib/server/notion/records";

async function main() {
  console.log("── 衣氣象 Notion 測試 ──\n");

  if (!isNotionConfigured()) {
    console.log("❌ 未設定環境變數");
    console.log("   請建立 .env.local 並填入：");
    console.log("   NOTION_API_KEY=secret_...");
    console.log("   NOTION_DATABASE_ID=32字元ID");
    process.exit(1);
  }

  console.log("✓ 環境變數已讀取");
  console.log("  NOTION_DATABASE_ID:", process.env.NOTION_DATABASE_ID?.slice(0, 8) + "...");

  const sample = {
    userName: "API測試",
    location: "台北市",
    startedAt: new Date().toISOString(),
    weather: "多雲",
    temperature: 26,
    apparentTemp: "27",
    humidity: 72,
    rainProb: 30,
    uvIndex: 5,
  };

  console.log("\n1/2 POST 建立紀錄...");
  const created = await createRecordInNotion(sample);
  console.log(JSON.stringify(created, null, 2));

  if (!created.ok || !created.data?.id) {
    console.log("\n❌ 建立失敗，請依 error 訊息檢查 Notion 欄位與 Weather 選項");
    process.exit(1);
  }

  if (created.source !== "notion") {
    console.log("\n⚠️  仍為 mock 模式（source !== notion）");
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
    console.log("\n✅ 串接成功！請到 Notion 資料表查看「API測試」那一列。");
  } else {
    console.log("\n❌ 更新失敗");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌ 執行錯誤:", err);
  process.exit(1);
});
