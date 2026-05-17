/** 最小測試用 handler（CommonJS） */
module.exports = function handler(_req, res) {
  res.status(200).json({ ok: true, pong: true, runtime: "node-cjs" });
};
