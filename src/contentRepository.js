const { sql, getPool } = require("./db");

const SORT_COLUMNS = {
  id: "id",
  title: "title",
  content_type: "content_type",
  release_year: "release_year",
  date_added: "date_added",
  rating: "rating",
  duration_value: "duration_value",
};

const CONTENT_COLUMNS = `
  id,
  source_id,
  content_type,
  title,
  CONVERT(varchar(10), date_added, 23) AS date_added,
  release_year,
  rating,
  duration_value,
  duration_unit,
  duration_text,
  description
`;

function normalizePagination({ page, pageSize }) {
  const parsedPage = Number.parseInt(page, 10);
  const parsedSize = Number.parseInt(pageSize, 10);
  return {
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    pageSize:
      Number.isInteger(parsedSize) && parsedSize > 0
        ? Math.min(parsedSize, 100)
        : 10,
  };
}

function applyFilters(request, { search, type }) {
  const conditions = [];
  const term = String(search || "").trim();
  const contentType = String(type || "")
    .trim()
    .toUpperCase();

  if (term) {
    request.input("search", sql.NVarChar(520), `%${term}%`);
    conditions.push("(title LIKE @search OR source_id LIKE @search)");
  }

  if (contentType) {
    request.input("type", sql.NVarChar(20), contentType);
    conditions.push("content_type = @type");
  }

  return conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
}

function bindContentInputs(request, content) {
  request.input("source_id", sql.NVarChar(20), content.source_id);
  request.input("content_type", sql.NVarChar(20), content.content_type);
  request.input("title", sql.NVarChar(500), content.title);
  request.input("date_added", sql.Date, content.date_added);
  request.input("release_year", sql.SmallInt, content.release_year);
  request.input("rating", sql.NVarChar(30), content.rating);
  request.input("duration_value", sql.Int, content.duration_value);
  request.input("duration_unit", sql.NVarChar(20), content.duration_unit);
  request.input("duration_text", sql.NVarChar(50), content.duration_text);
  request.input("description", sql.NVarChar(sql.MAX), content.description);
}

async function listContent(options) {
  const { page, pageSize } = normalizePagination(options);
  const sort = SORT_COLUMNS[options.sort] || SORT_COLUMNS.id;
  const direction =
    String(options.dir).toLowerCase() === "desc" ? "DESC" : "ASC";
  const offset = (page - 1) * pageSize;
  const pool = await getPool();

  const countRequest = pool.request();
  const countWhere = applyFilters(countRequest, options);
  const countResult = await countRequest.query(
    `SELECT COUNT(*) AS total FROM dbo.content ${countWhere};`,
  );
  const total = countResult.recordset[0].total;

  const dataRequest = pool.request();
  const dataWhere = applyFilters(dataRequest, options);
  dataRequest.input("offset", sql.Int, offset);
  dataRequest.input("pageSize", sql.Int, pageSize);
  const dataResult = await dataRequest.query(`
    SELECT ${CONTENT_COLUMNS}
    FROM dbo.content
    ${dataWhere}
    ORDER BY ${sort} ${direction}
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
  `);

  return {
    data: dataResult.recordset,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    sort: Object.keys(SORT_COLUMNS).find((key) => SORT_COLUMNS[key] === sort),
    dir: direction.toLowerCase(),
  };
}

async function getContentById(id) {
  const pool = await getPool();
  const request = pool.request();
  request.input("id", sql.Int, id);
  const result = await request.query(`
    SELECT ${CONTENT_COLUMNS}
    FROM dbo.content
    WHERE id = @id;
  `);
  return result.recordset[0] || null;
}

async function createContent(content) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const idRequest = new sql.Request(transaction);
    const idResult = await idRequest.query(`
      SELECT ISNULL(MAX(id), 0) + 1 AS nextId
      FROM dbo.content WITH (UPDLOCK, HOLDLOCK);
    `);
    const nextId = idResult.recordset[0].nextId;

    const insertRequest = new sql.Request(transaction);
    insertRequest.input("id", sql.Int, nextId);
    bindContentInputs(insertRequest, content);
    const result = await insertRequest.query(`
      INSERT INTO dbo.content (
        id, source_id, content_type, title, date_added, release_year,
        rating, duration_value, duration_unit, duration_text, description
      )
      OUTPUT
        INSERTED.id,
        INSERTED.source_id,
        INSERTED.content_type,
        INSERTED.title,
        CONVERT(varchar(10), INSERTED.date_added, 23) AS date_added,
        INSERTED.release_year,
        INSERTED.rating,
        INSERTED.duration_value,
        INSERTED.duration_unit,
        INSERTED.duration_text,
        INSERTED.description
      VALUES (
        @id, @source_id, @content_type, @title, @date_added, @release_year,
        @rating, @duration_value, @duration_unit, @duration_text, @description
      );
    `);

    await transaction.commit();
    return result.recordset[0];
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

async function updateContent(id, content) {
  const pool = await getPool();
  const request = pool.request();
  request.input("id", sql.Int, id);
  bindContentInputs(request, content);
  const result = await request.query(`
    UPDATE dbo.content
    SET
      source_id = @source_id,
      content_type = @content_type,
      title = @title,
      date_added = @date_added,
      release_year = @release_year,
      rating = @rating,
      duration_value = @duration_value,
      duration_unit = @duration_unit,
      duration_text = @duration_text,
      description = @description
    OUTPUT
      INSERTED.id,
      INSERTED.source_id,
      INSERTED.content_type,
      INSERTED.title,
      CONVERT(varchar(10), INSERTED.date_added, 23) AS date_added,
      INSERTED.release_year,
      INSERTED.rating,
      INSERTED.duration_value,
      INSERTED.duration_unit,
      INSERTED.duration_text,
      INSERTED.description
    WHERE id = @id;
  `);
  return result.recordset[0] || null;
}

async function deleteContent(id) {
  const pool = await getPool();
  const request = pool.request();
  request.input("id", sql.Int, id);
  const result = await request.query(`
    DELETE FROM dbo.content
    OUTPUT
      DELETED.id,
      DELETED.source_id,
      DELETED.title
    WHERE id = @id;
  `);
  return result.recordset[0] || null;
}

async function getDatabaseInfo() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      DB_NAME() AS databaseName,
      (SELECT COUNT(*) FROM dbo.content) AS totalContent;
  `);
  return result.recordset[0];
}

async function getRowsForStats() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      content_type,
      release_year
    FROM dbo.content;
  `);
  return result.recordset;
}

module.exports = {
  listContent,
  getContentById,
  createContent,
  updateContent,
  deleteContent,
  getDatabaseInfo,
  getRowsForStats,
};
