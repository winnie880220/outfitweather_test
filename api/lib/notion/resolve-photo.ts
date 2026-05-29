import { env } from "../env";
import { httpFetch } from "../http-fetch";
import { notionRequest } from "./client";
import { parseNotionPage, type NotionProp, type ParsedNotionRecord } from "./parse-page";
import { RECORDS_DB } from "./schema";

/** 與 upload-photo.ts 一致，讀取 file_upload 需較新版本 */
const NOTION_FILE_VERSION = "2025-09-03";

type FileUploadRetrieve = {
  status?: string;
  complete_url?: string;
  url?: string;
};

type PageResponse = {
  id: string;
  properties: Record<string, NotionProp>;
};

async function fetchFileUploadUrl(fileUploadId: string): Promise<string | undefined> {
  const res = await httpFetch(`https://api.notion.com/v1/file_uploads/${fileUploadId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.notionApiKey}`,
      "Notion-Version": NOTION_FILE_VERSION,
    },
  });

  const data = (await res.json()) as FileUploadRetrieve & { message?: string };
  if (!res.ok) return undefined;
  return data.complete_url ?? data.url;
}

/** 重新讀取單頁 Photo 欄位（查詢列表有時只有 file_upload id） */
async function fetchPhotoUrlFromPage(pageId: string): Promise<string | undefined> {
  try {
    const page = await notionRequest<PageResponse>(`/pages/${pageId}`, { method: "GET" });
    const parsed = parseNotionPage({ id: page.id, properties: page.properties });
    return parsed?.photoUrl;
  } catch {
    return undefined;
  }
}

/** 補齊 Notion file_upload 照片的下載網址，供靈感卡片使用 */
export async function hydrateRecordPhotoUrls(records: ParsedNotionRecord[]): Promise<void> {
  const targets = records.filter((r) => !r.photoUrl);
  if (targets.length === 0) return;

  await Promise.all(
    targets.map(async (record) => {
      if (record.photoFileUploadId) {
        const fromUpload = await fetchFileUploadUrl(record.photoFileUploadId);
        if (fromUpload) {
          record.photoUrl = fromUpload;
          return;
        }
      }
      const fromPage = await fetchPhotoUrlFromPage(record.id);
      if (fromPage) record.photoUrl = fromPage;
    })
  );
}
