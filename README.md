# PrimeVideoDB - CRUD con WebSockets y Worker Thread

Aplicación web sencilla sobre la tabla `content` de la base de datos **primevideodb** (SQL Server). Incluye un CRUD completo, sincronización en tiempo real entre clientes y un procesamiento de estadísticas en un Worker Thread.

## Tecnologías

- Node.js + Express
- SQL Server Express + paquete `mssql` (`msnodesqlv8`)
- Socket.IO (WebSockets)
- `worker_threads` de Node.js
- HTML, CSS y JavaScript sin frameworks

## Estructura

```
src/
  server.js              Servidor Express + Socket.IO
  db.js                  Conexión a SQL Server
  contentRepository.js   Consultas CRUD
  validation.js          Validación de datos
  routes/content.js      Endpoints del CRUD
  routes/stats.js        Endpoint del Worker Thread
  statsWorker.js         Procesamiento concurrente
  statsService.js        Ejecución del Worker
public/
  index.html             Interfaz del CRUD
  styles.css
  app.js
scripts/
  verify-db.js           Verificación de primevideodb
content.sql              Definición de la tabla content
```

## Configuración

1. Copiar `.env.example` a `.env` y ajustar la cadena de conexión:

```
DB_CONNECTION_STRING=Driver={ODBC Driver 17 for SQL Server};Server={autenticacion_windows};Database={nombre_bd};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;
PORT=3000
```

2. Instalar dependencias:

```
npm install
```

3. Verificar la base de datos (se esperan aproximadamente 9,668 registros):

```
npm run verify-db
```

4. Iniciar la aplicación:

```
npm start
```

Abrir <http://localhost:3000>.

## Funcionalidades

### CRUD

- Listar contenidos con búsqueda, filtro por tipo y paginación.
- Registrar un contenido.
- Editar un contenido desde el botón **Editar**.
- Eliminar un contenido desde el botón **Eliminar**.

### Tiempo real con WebSockets

Cuando un cliente crea, edita o elimina un contenido, el servidor emite un evento Socket.IO y los demás clientes actualizan la tabla automáticamente, sin recargar la página.

Eventos: `content:created`, `content:updated`, `content:deleted`, `clients:update`.

### Worker Thread

`GET /api/stats/worker` procesa los registros en un hilo secundario y devuelve:

- cantidad de películas, series y otros;
- contenidos por década;
- identificador del Worker Thread y tiempos de ejecución.

El hilo principal consulta la base de datos y envía al Worker únicamente el tipo y el año de cada contenido. El Worker calcula las estadísticas sin bloquear el hilo principal de Express.

## API

| Método | Ruta                | Descripción                            |
| ------ | ------------------- | -------------------------------------- |
| GET    | `/api/health/db`    | Verifica conexión y total de registros |
| GET    | `/api/content`      | Lista paginada                         |
| GET    | `/api/content/:id`  | Obtiene un contenido                   |
| POST   | `/api/content`      | Registra un contenido                  |
| PUT    | `/api/content/:id`  | Edita un contenido                     |
| DELETE | `/api/content/:id`  | Elimina un contenido                   |
| GET    | `/api/stats/worker` | Estadísticas con Worker Thread         |
| GET    | `/api/ping`         | Prueba rápida de disponibilidad        |
