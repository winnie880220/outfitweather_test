import { getNotionDatabaseId, isNotionConfigured } from "../env";
import { notionRequest } from "./client";
import { parseNotionPage, type NotionProp, type ParsedNotionRecord } from "./parse-page";
import { RECORDS_DB } from "./schema";

type QueryResponse = {
  results: Array<{ id: string; properties: Record<string, unknown> }>;
  has_more: boolean;
  next_cursor: string | null;
};

/** 查詢氣溫落在 [temp - delta, temp + delta] 的紀錄 */
export async function queryRecordsByTemperature(
  temp: number,
  delta = 1
): Promise<ParsedNotionRecord[]> {
  if (!isNotionConfigured()) {
    return [];
  }

  const min = temp - delta;
  const max = temp + delta;
  const records: ParsedNotionRecord[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      filter: {
        and: [
          {
            property: RECORDS_DB.temperature,
            number: { greater_than_or_equal_to: min },
          },
          {
            property: RECORDS_DB.temperature,
            number: { less_than_or_equal_to: max },
          },
        ],
      },
      sorts: [{ property: RECORDS_DB.startedAt, direction: "descending" }],
    };
    if (cursor) body.start_cursor = cursor;

    const res = await notionRequest<QueryResponse>(
      `/databases/${getNotionDatabaseId()}/query`,
      { method: "POST", body: JSON.stringify(body) }
    );

    for (const page of res.results) {
      const parsed = parseNotionPage({
        id: page.id,
        properties: page.properties as Record<string, NotionProp>,
      });
      if (parsed) records.push(parsed);
    }

    cursor = res.has_more && res.next_cursor ? res.next_cursor : undefined;
  } while (cursor);

  return records;
}

/** 查詢指定 userName 的全部紀錄（含 active 與歷史列） */
export async function queryRecordsByUserName(
  userName: string
): Promise<Array<{ id: string; properties: Record<string, NotionProp> }>> {
  if (!isNotionConfigured()) {
    return [];
  }

  const trimmed = userName.trim();
  if (!trimmed) return [];

  const pages: Array<{ id: string; properties: Record<string, NotionProp> }> = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      filter: {
        property: RECORDS_DB.userName,
        title: { equals: trimmed },
      },
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

function recordIdFilter(
  value: string,
  fieldType: string
): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (fieldType === "number") {
    const n = Number(trimmed);
    if (Number.isNaN(n)) return null;
    return {
      property: RECORDS_DB.recordId,
      number: { equals: n },
    };
  }

  if (fieldType === "unique_id") {
    return {
      property: RECORDS_DB.recordId,
      unique_id: { equals: trimmed },
    };
  }

  return {
    property: RECORDS_DB.recordId,
    rich_text: { equals: trimmed },
  };
}

/** 依「ID」欄位值查詢穿搭紀錄 */
export async function queryRecordsByRecordIds(
  recordIds: string[],
  idFieldType = "rich_text"
): Promise<ParsedNotionRecord[]> {
  if (!isNotionConfigured()) {
    return [];
  }

  const unique = [...new Set(recordIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const filters = unique
    .map((id) => recordIdFilter(id, idFieldType))
    .filter((f): f is Record<string, unknown> => f !== null);

  if (filters.length === 0) return [];

  const records: ParsedNotionRecord[] = [];
  const seenPageIds = new Set<string>();
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      filter: filters.length === 1 ? filters[0] : { or: filters },
      sorts: [{ property: RECORDS_DB.startedAt, direction: "descending" }],
    };
    if (cursor) body.start_cursor = cursor;

    const res = await notionRequest<QueryResponse>(
      `/databases/${getNotionDatabaseId()}/query`,
      { method: "POST", body: JSON.stringify(body) }
    );

    for (const page of res.results) {
      if (seenPageIds.has(page.id)) continue;
      seenPageIds.add(page.id);
      const parsed = parseNotionPage({
        id: page.id,
        properties: page.properties as Record<string, NotionProp>,
      });
      if (parsed) records.push(parsed);
    }

    cursor = res.has_more && res.next_cursor ? res.next_cursor : undefined;
  } while (cursor);

  return records;
}
