/** Notion 回傳 page／block 已封存、無法 PATCH 時的訊息 */
export function isNotionArchivedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /archived/i.test(msg);
}
