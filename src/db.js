const sql = require("mssql/msnodesqlv8");

const connectionString = process.env.DB_CONNECTION_STRING;

if (!connectionString) {
  throw new Error(
    "Falta la variable DB_CONNECTION_STRING. Copie .env.example a .env y configure SQL Server.",
  );
}

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect({ connectionString }).catch((error) => {
      poolPromise = undefined;
      throw error;
    });
  }
  return poolPromise;
}

async function closePool() {
  if (poolPromise) {
    const pool = await poolPromise.catch(() => null);
    if (pool) {
      await pool.close();
    }
    poolPromise = undefined;
  }
}

module.exports = { sql, getPool, closePool };
