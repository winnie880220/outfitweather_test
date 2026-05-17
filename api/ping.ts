export const config = { runtime: "edge" as const };

export default function handler() {
  return new Response(JSON.stringify({ ok: true, pong: true }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
