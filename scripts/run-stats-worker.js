require("dotenv").config();

const { threadId: mainThreadId } = require("node:worker_threads");
const { getRowsForStats } = require("../src/contentRepository");
const { runStatsWorker } = require("../src/statsService");
const { closePool } = require("../src/db");

async function main() {
  const rows = await getRowsForStats();
  const startedAt = Date.now();
  const stats = await runStatsWorker(rows);
  const elapsedMs = Date.now() - startedAt;

  console.log("=== WORKER THREAD ===");
  console.log(`Hilo principal: #${mainThreadId}`);
  console.log(`Worker Thread: #${stats.workerThreadId}`);
  console.log(`Registros procesados: ${rows.length}`);
  console.log(`Tiempo total: ${elapsedMs} ms`);
  console.log(`Tiempo dentro del worker: ${stats.workerElapsedMs} ms`);
  console.log(`Películas: ${stats.movies}`);
  console.log(`Series: ${stats.tvShows}`);
  console.log(`Otros: ${stats.others}`);
  console.log("Contenidos por década:");
  for (const item of stats.byDecade) {
    console.log(`  ${item.decade}: ${item.count}`);
  }

  await closePool();
}

main().catch(async (error) => {
  console.error("No se pudo ejecutar el Worker Thread:", error.message);
  await closePool().catch(() => {});
  process.exit(1);
});
