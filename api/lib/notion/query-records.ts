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
