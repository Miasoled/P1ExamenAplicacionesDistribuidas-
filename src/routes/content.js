const express = require("express");
const {
  listContent,
  getContentById,
  createContent,
  updateContent,
  deleteContent,
  getDatabaseInfo,
} = require("../contentRepository");
const { normalizeContent } = require("../validation");

const router = express.Router();

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function actorId(req) {
  const value = req.header("x-socket-id");
  return typeof value === "string" ? value : null;
}

function notify(req, event, payload) {
  const io = req.app.get("io");
  if (io) {
    io.emit(event, { ...payload, actorId: actorId(req), at: new Date().toISOString() });
  }
}

function handleDatabaseError(error, res) {
  if (error.number === 2627 || error.number === 2601) {
    return res.status(409).json({
      error: "El identificador de origen (source_id) ya existe.",
      field: "source_id",
    });
  }
  if (error.number === 547) {
    return res.status(400).json({
      error: "Los datos no cumplen una restricciÃ³n de la tabla content.",
    });
  }
  if (error.number === 8152 || error.number === 2628) {
    return res.status(400).json({
      error: "Uno de los textos supera la longitud permitida por la tabla.",
    });
  }
  console.error("Error de base de datos:", error);
  return res.status(500).json({ error: "No se pudo completar la operaciÃ³n en la base de datos." });
}

router.get("/", async (req, res, next) => {
  try {
    const result = await listContent({
      page: req.query.page,
      pageSize: req.query.pageSize,
      search: req.query.search,
      type: req.query.type,
      sort: req.query.sort,
      dir: req.query.dir,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "El id debe ser un entero positivo." });
    const content = await getContentById(id);
    if (!content) return res.status(404).json({ error: "Contenido no encontrado." });
    return res.json({ content });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { value, errors } = normalizeContent(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: "Datos invÃ¡lidos.", details: errors });
    }
    const content = await createContent(value);
    notify(req, "content:created", { content, total: await currentTotal() });
    return res.status(201).json({ content });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "El id debe ser un entero positivo." });

    const { value, errors } = normalizeContent(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: "Datos invÃ¡lidos.", details: errors });
    }

    const content = await updateContent(id, value);
    if (!content) return res.status(404).json({ error: "Contenido no encontrado." });

    notify(req, "content:updated", { content, total: await currentTotal() });
    return res.json({ content });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "El id debe ser un entero positivo." });

    const content = await deleteContent(id);
    if (!content) return res.status(404).json({ error: "Contenido no encontrado." });

    notify(req, "content:deleted", { content, total: await currentTotal() });
    return res.json({ content });
  } catch (error) {
    return next(error);
  }
});

async function currentTotal() {
  try {
    const info = await getDatabaseInfo();
    return info.totalContent;
  } catch {
    return null;
  }
}

module.exports = router;

