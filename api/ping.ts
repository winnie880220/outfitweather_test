import { edgeConfig, jsonResponse } from "./lib/edge";

export const config = edgeConfig;

export default function handler() {
  return jsonResponse(200, { ok: true, pong: true });
}
