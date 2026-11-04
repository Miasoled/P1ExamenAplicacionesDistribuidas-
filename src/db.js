const sql = require("mssql/msnodesqlv8");
const connectionString = process.env.DB_CONNECTION_STRING;

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

module.exports = { sql, getPool, connectionString };
