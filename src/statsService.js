const path = require("node:path");
const { Worker } = require("node:worker_threads");

function runStatsWorker(rows) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, "statsWorker.js"), {
      workerData: rows,
    });

    let settled = false;

    worker.once("message", (message) => {
      settled = true;
      resolve(message);
    });

    worker.once("error", (error) => {
      settled = true;
      reject(error);
    });

    worker.once("exit", (code) => {
      if (!settled) {
        reject(
          new Error(
            `El Worker Thread finalizó sin resultados (código ${code}).`,
          ),
        );
      }
    });
  });
}

module.exports = { runStatsWorker };
