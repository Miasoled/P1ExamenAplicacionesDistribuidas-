require("dotenv").config();

const http = require("node:http");
const path = require("node:path");
const express = require("express");
const { Server } = require("socket.io");
const { getPool, closePool } = require("./db");
const { getDatabaseInfo } = require("./contentRepository");
const contentRouter = require("./routes/content");
const statsRouter = require("./routes/stats");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: false },
});

app.disable("x-powered-by");
app.set("io", io);
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/ping", (_req, res) => {
  res.json({ ok: true, at: new Date().toISOString(), uptimeSeconds: process.uptime() });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    await getPool();
    const info = await getDatabaseInfo();
    res.json({
      connected: true,
      database: info.databaseName,
      totalContent: info.totalContent,
      serverTime: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      clients: io.engine.clientsCount,
    });
  } catch (error) {
    console.error("No se pudo verificar la base de datos:", error);
    res.status(503).json({
      connected: false,
      error: "No se pudo conectar a SQL Server (primevideodb).",
    });
  }
});

app.use("/api/content", contentRouter);
app.use("/api/stats", statsRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Recurso no encontrado." });
});

app.use((error, req, res, _next) => {
  console.error("Error no controlado:", error);
  if (req.path.startsWith("/api")) {
    return res.status(500).json({ error: "Error interno del servidor." });
  }
  return res.status(500).send("Error interno del servidor.");
});

io.on("connection", (socket) => {
  const clients = io.engine.clientsCount;
  console.log(`Cliente WebSocket conectado: ${socket.id} (total: ${clients})`);

  socket.emit("server:hello", {
    socketId: socket.id,
    clients,
    at: new Date().toISOString(),
  });
  io.emit("clients:update", { clients });

  socket.on("disconnect", (reason) => {
    console.log(`Cliente WebSocket desconectado: ${socket.id} (${reason})`);
    io.emit("clients:update", { clients: io.engine.clientsCount });
  });
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`Aplicación disponible en http://localhost:${port}`);
  console.log("Base de datos: primevideodb (SQL Server)");
});

async function shutdown(signal) {
  console.log(`\n${signal} recibido. Cerrando aplicación...`);
  io.close();
  server.close(async () => {
    await closePool().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
