/**
 * 稽核 Notion 資料庫：總筆數、溫度分布、解析失敗、溫度區間命中數
 * 執行：pnpm exec tsx scripts/audit-notion-db.ts
 */
import "./load-env";
import { getNotionDatabaseId, isNotionConfigured } from "../api/lib/env";
import { notionRequest } from "../api/lib/notion/client";
import { parseNotionPage, type NotionProp } from "../api/lib/notion/parse-page";
import { RECORDS_DB } from "../api/lib/notion/schema";
import { queryRecordsByTemperature } from "../api/lib/notion/query-records";
import { getOutfitInsights } from "../api/lib/notion/outfit-insights";

type QueryResponse = {
  results: Array<{ id: string; properties: Record<string, unknown> }>;
  has_more: boolean;
  next_cursor: string | null;
};

async function fetchAllPages() {
  const pages: Array<{ id: string; properties: Record<string, NotionProp> }> = [];
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      sorts: [{ property: RECORDS_DB.startedAt, direction: "descending" }],
    };
    if (cursor) body.start_cursor = cursor;
    const res = await notionRequest<QueryResponse>(
      `/databases/${getNotionDatabaseId()}/query`,
      { method: "POST", body: JSON.stringify(body) }
    );
    for (const page of res.results) {
      pages.push({
        id: page.id,
        properties: page.properties as Record<string, NotionProp>,
      });
    }
    cursor = res.has_more && res.next_cursor ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function main() {
  if (!isNotionConfigured()) {
    console.log("❌ NOTION 未設定");
    process.exit(1);
  }

  const dbId = getNotionDatabaseId();
  console.log("── Notion 資料庫稽核 ──\n");
  console.log("Database ID:", dbId);

  const meta = await notionRequest<{ title: Array<{ plain_text: string }>; properties: Record<string, { type: string; name?: string }> }>(
    `/databases/${dbId}`
  );
  console.log("名稱:", meta.title?.[0]?.plain_text ?? "(無)");
  console.log("\n欄位（Notion 實際名稱 → 類型）:");
  const propNames = Object.keys(meta.properties).sort();
  for (const name of propNames) {
    const p = meta.properties[name];
    console.log(`  - ${name} (${p.type})`);
  }

  const expected = Object.values(RECORDS_DB);
  const missing = expected.filter((n) => !propNames.includes(n));
  const extra = propNames.filter((n) => !expected.includes(n));
  if (missing.length) console.log("\n⚠️  schema 期待但 DB 沒有的欄位:", missing.join(", "));
  if (extra.length) console.log("ℹ️  DB 有但 schema 未列的欄位:", extra.slice(0, 15).join(", "), extra.length > 15 ? "..." : "");

  console.log("\n載入全部頁面...");
  const pages = await fetchAllPages();
  console.log("總頁面數（Notion rows）:", pages.length);

  let parseOk = 0;
  let noUserName = 0;
  let noTemp = 0;
  let hasColor = 0;
  let hasPhoto = 0;
  const temps: number[] = [];
  const locations = new Map<string, number>();

  for (const page of pages) {
    const parsed = parseNotionPage(page);
    if (!parsed) {
      noUserName++;
      continue;
    }
    parseOk++;
    if (parsed.temperature == null) noTemp++;
    else temps.push(parsed.temperature);
    if (parsed.colors.length) hasColor++;
    if (parsed.photoUrl || parsed.photoFileUploadId) hasPhoto++;
    const loc = parsed.location.trim() || "(空)";
    locations.set(loc, (locations.get(loc) ?? 0) + 1);
  }

  console.log("\n── 解析結果 ──");
  console.log("可解析（有 userName）:", parseOk);
  console.log("解析失敗（缺 userName）:", noUserName);
  console.log("缺 Temperature 數值:", noTemp);
  console.log("有 color 標籤:", hasColor);
  console.log("有照片:", hasPhoto);

  if (temps.length) {
    temps.sort((a, b) => a - b);
    console.log("\n── Temperature 分布 ──");
    console.log("  最小:", temps[0], "最大:", temps[temps.length - 1], "平均:", (temps.reduce((s, t) => s + t, 0) / temps.length).toFixed(1));
    const buckets = new Map<string, number>();
    for (const t of temps) {
      const k = `${Math.round(t / 5) * 5}-${Math.round(t / 5) * 5 + 4}`;
      buckets.set(k, (buckets.get(k) ?? 0) + 1);
    }
    console.log("  區間（約每 5°C）:");
    [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, c]) => console.log(`    ${k}°: ${c} 筆`));
  }

  console.log("\n── Location 前 10 ──");
  [...locations.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([loc, c]) => console.log(`  ${loc}: ${c}`));

  console.log("\n── 溫度區間查詢（App 同款 filter）──");
  for (const temp of [20, 24, 26, 28, 30, 32]) {
    for (const delta of [1, 2]) {
      const hits = await queryRecordsByTemperature(temp, delta);
      console.log(`  temp=${temp} ±${delta} → ${hits.length} 筆`);
    }
  }

  console.log("\n── 靈感 API 模擬（台北市）──");
  for (const temp of [26, 28, 30]) {
    const ins = await getOutfitInsights(temp, 2, "台北市");
    console.log(`  ${temp}°C ±2 台北市: sample=${ins.sampleCount}, inspiration=${ins.inspiration.length}`);
  }

  console.log("\n✅ 稽核完成");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
