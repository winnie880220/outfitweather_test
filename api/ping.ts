import { sendJson, type VercelRequest, type VercelResponse } from "./lib/vercel";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  sendJson(res, 200, { ok: true, pong: true });
}
