const express = require("express");
const { threadId: mainThreadId } = require("node:worker_threads");
const { getRowsForStats } = require("../contentRepository");
const { runStatsWorker } = require("../statsService");

const router = express.Router();

router.get("/worker", async (_req, res, next) => {
  try {
    const rows = await getRowsForStats();
    const startedAt = Date.now();
    const stats = await runStatsWorker(rows);
    const elapsedMs = Date.now() - startedAt;

    res.json({
      stats,
      rowsSentToWorker: rows.length,
      elapsedMs,
      mainThreadId,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
