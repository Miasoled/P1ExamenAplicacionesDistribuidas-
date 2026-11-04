const { parentPort, workerData, threadId } = require("node:worker_threads");
const { performance } = require("node:perf_hooks");

const startedAt = performance.now();
const rows = Array.isArray(workerData) ? workerData : [];
const byType = { MOVIE: 0, TV_SHOW: 0, OTHER: 0 };
const decades = new Map();

for (const row of rows) {
  const type = String(row.content_type || "OTHER")
    .trim()
    .toUpperCase();
  if (type === "MOVIE") {
    byType.MOVIE += 1;
  } else if (type === "TV_SHOW" || type === "TV SHOW") {
    byType.TV_SHOW += 1;
  } else {
    byType.OTHER += 1;
  }

  const year = Number(row.release_year);
  if (Number.isInteger(year) && year > 0) {
    const decade = `${Math.floor(year / 10) * 10}s`;
    decades.set(decade, (decades.get(decade) || 0) + 1);
  }
}

parentPort.postMessage({
  total: rows.length,
  movies: byType.MOVIE,
  tvShows: byType.TV_SHOW,
  others: byType.OTHER,
  byDecade: [...decades.entries()]
    .sort((a, b) => Number.parseInt(a[0], 10) - Number.parseInt(b[0], 10))
    .map(([decade, count]) => ({ decade, count })),
  workerThreadId: threadId,
  workerElapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
});
