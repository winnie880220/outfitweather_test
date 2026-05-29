import { env } from "../env";
import { httpFetch } from "../http-fetch";

/** Notion 檔案上傳 API 需較新版本 */
const NOTION_FILE_VERSION = "2025-09-03";

function stripBase64(input: string): string {
  const match = input.match(/^data:[^;]+;base64,(.+)$/);
  return (match ? match[1] : input).replace(/\s/g, "");
}

/**
 * 上傳圖片至 Notion File Upload，回傳 file_upload id 供 Photo 欄位使用。
 * @see https://developers.notion.com/docs/uploading-small-files
 */
export async function uploadImageToNotion(
  imageBase64: string,
  mimeType: string,
  filename = "outfit.jpg"
): Promise<string> {
  const base64 = stripBase64(imageBase64);
  const buffer = Buffer.from(base64, "base64");

  const createRes = await httpFetch("https://api.notion.com/v1/file_uploads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.notionApiKey}`,
      "Notion-Version": NOTION_FILE_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename,
      content_type: mimeType || "image/jpeg",
    }),
  });

  const createData = (await createRes.json()) as { id?: string; message?: string };
  if (!createRes.ok || !createData.id) {
    throw new Error(createData.message ?? `Notion 建立上傳失敗 (${createRes.status})`);
  }

  const form = new FormData();
  const blob = new Blob([buffer], { type: mimeType || "image/jpeg" });
  form.append("file", blob, filename);

  const sendRes = await httpFetch(
    `https://api.notion.com/v1/file_uploads/${createData.id}/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.notionApiKey}`,
        "Notion-Version": NOTION_FILE_VERSION,
      },
      body: form,
    }
  );

  if (!sendRes.ok) {
    const err = (await sendRes.json()) as { message?: string };
    throw new Error(err.message ?? `Notion 上傳圖片失敗 (${sendRes.status})`);
  }

  return createData.id;
}
