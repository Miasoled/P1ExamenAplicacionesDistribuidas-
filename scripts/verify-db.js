require("dotenv").config();

const { getPool, closePool } = require("../src/db");

async function main() {
  const pool = await getPool();

  const info = await pool.request().query(`
    SELECT
      DB_NAME() AS databaseName,
      @@SERVERNAME AS serverName,
      (SELECT COUNT(*) FROM dbo.content) AS totalContent;
  `);
  const { databaseName, serverName, totalContent } = info.recordset[0];

  console.log("=== VERIFICACIÓN DE primevideodb ===");
  console.log(`Servidor: ${serverName}`);
  console.log(`Base de datos: ${databaseName}`);
  console.log(`Total de registros en content: ${totalContent}`);
  console.log("");

  const sample = await pool.request().query(`
    SELECT TOP 10
      id,
      source_id,
      content_type,
      title,
      release_year,
      rating,
      duration_text
    FROM dbo.content
    ORDER BY id;
  `);

  console.table(sample.recordset);
  await closePool();
}

main().catch(async (error) => {
  console.error("No se pudo verificar la base de datos:", error.message);
  await closePool().catch(() => {});
  process.exit(1);
});
