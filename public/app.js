const state = {
  page: 1,
  pageSize: 10,
  search: "",
  type: "",
  totalPages: 1,
  total: 0,
  rows: [],
  editingId: null,
  socketId: null,
};

const $ = (id) => document.getElementById(id);

const els = {
  totalInfo: $("totalInfo"),
  wsStatus: $("wsStatus"),
  formTitle: $("formTitle"),
  form: $("contentForm"),
  contentId: $("contentId"),
  title: $("title"),
  sourceId: $("source_id"),
  contentType: $("content_type"),
  releaseYear: $("release_year"),
  rating: $("rating"),
  dateAdded: $("date_added"),
  durationValue: $("duration_value"),
  durationUnit: $("duration_unit"),
  durationText: $("duration_text"),
  description: $("description"),
  formMessage: $("formMessage"),
  saveBtn: $("saveBtn"),
  cancelBtn: $("cancelBtn"),
  closeFormBtn: $("closeFormBtn"),
  formCard: $("formCard"),
  createBtn: $("createBtn"),
  workerBtn: $("workerBtn"),
  workerResult: $("workerResult"),
  tbody: $("tbody"),
  search: $("search"),
  typeFilter: $("typeFilter"),
  pageSize: $("pageSize"),
  prev: $("prev"),
  next: $("next"),
  pageInfo: $("pageInfo"),
  toast: $("toast"),
};

const numberFormat = new Intl.NumberFormat("es-BO");

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? numberFormat.format(number) : "—";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[character];
  });
}

let toastTimer;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 5000);
}

function showMessage(text, ok = false) {
  els.formMessage.textContent = text;
  els.formMessage.classList.toggle("ok", ok);
  els.formMessage.classList.remove("hidden");
}

function hideMessage() {
  els.formMessage.classList.add("hidden");
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const method = String(options.method || "GET").toUpperCase();

  if (method !== "GET" && state.socketId) {
    headers["x-socket-id"] = state.socketId;
  }
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || `Error HTTP ${response.status}`);
    error.details = data.details || null;
    throw error;
  }
  return data;
}

async function loadHealth() {
  try {
    const data = await api("/api/health/db");
    els.wsStatus.classList.remove("bad");
    els.wsStatus.classList.add("ok");
    els.totalInfo.textContent = `${formatNumber(data.totalContent)} registros`;
  } catch (error) {
    els.wsStatus.classList.remove("ok");
    els.wsStatus.classList.add("bad");
    els.wsStatus.textContent = "Sin conexión a la BD";
    console.error(error);
  }
}

async function loadContent() {
  els.tbody.innerHTML = '<tr><td colspan="7" class="empty">Cargando...</td></tr>';

  const params = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.pageSize),
    sort: "id",
    dir: "desc",
  });
  if (state.search) params.set("search", state.search);
  if (state.type) params.set("type", state.type);

  try {
    const data = await api(`/api/content?${params.toString()}`);
    state.rows = data.data;
    state.total = data.total;
    state.totalPages = data.totalPages;
    state.page = data.page;
    els.totalInfo.textContent = `${formatNumber(data.total)} registros`;
    renderRows();
    updatePager();
  } catch (error) {
    els.tbody.innerHTML = "";
    els.tbody.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(
      error.message,
    )}</td></tr>`;
  }
}

function durationLabel(row) {
  if (row.duration_text) return row.duration_text;
  if (row.duration_value === null || row.duration_value === undefined) return "—";
  const units = { MINUTES: "min", SEASONS: "temporadas" };
  return `${row.duration_value} ${units[row.duration_unit] || ""}`.trim();
}

function renderRows() {
  if (!state.rows.length) {
    els.tbody.innerHTML = '<tr><td colspan="7" class="empty">No hay contenidos.</td></tr>';
    return;
  }

  els.tbody.innerHTML = state.rows
    .map((row) => {
      const badgeClass =
        row.content_type === "TV_SHOW" ? "tv" : row.content_type === "OTHER" ? "other" : "";
      return `
        <tr>
          <td>${row.id}</td>
          <td>${escapeHtml(row.title)}</td>
          <td><span class="badge ${badgeClass}">${escapeHtml(row.content_type)}</span></td>
          <td>${row.release_year ?? "—"}</td>
          <td>${escapeHtml(row.rating || "—")}</td>
          <td>${escapeHtml(durationLabel(row))}</td>
          <td class="actions">
            <button type="button" class="secondary" data-action="edit" data-id="${row.id}">Editar</button>
            <button type="button" class="danger" data-action="delete" data-id="${row.id}">Eliminar</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function updatePager() {
  els.pageInfo.textContent = `Página ${state.page} de ${state.totalPages}`;
  els.prev.disabled = state.page <= 1;
  els.next.disabled = state.page >= state.totalPages;
}

function resetForm() {
  state.editingId = null;
  els.form.reset();
  els.contentId.value = "";
  els.formTitle.textContent = "Nuevo contenido";
  els.saveBtn.textContent = "Guardar";
  hideMessage();
}

function showCreateForm() {
  resetForm();
  els.sourceId.value = `s${Date.now()}`;
  els.dateAdded.value = new Date().toISOString().slice(0, 10);
  els.formCard.classList.remove("hidden");
  els.title.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hideForm() {
  resetForm();
  els.formCard.classList.add("hidden");
}

function startEdit(id) {
  const row = state.rows.find((item) => Number(item.id) === Number(id));
  if (!row) return;

  state.editingId = row.id;
  els.contentId.value = row.id;
  els.title.value = row.title || "";
  els.sourceId.value = row.source_id || "";
  els.contentType.value = row.content_type || "MOVIE";
  els.releaseYear.value = row.release_year ?? "";
  els.rating.value = row.rating || "";
  els.dateAdded.value = row.date_added || "";
  els.durationValue.value = row.duration_value ?? "";
  els.durationUnit.value = row.duration_unit || "";
  els.durationText.value = row.duration_text || "";
  els.description.value = row.description || "";

  els.formTitle.textContent = `Editar contenido #${row.id}`;
  els.saveBtn.textContent = "Actualizar";
  hideMessage();
  els.formCard.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function handleSubmit(event) {
  event.preventDefault();
  hideMessage();
  els.saveBtn.disabled = true;

  const payload = {
    title: els.title.value,
    source_id: els.sourceId.value,
    content_type: els.contentType.value,
    release_year: els.releaseYear.value || null,
    rating: els.rating.value,
    date_added: els.dateAdded.value || null,
    duration_value: els.durationValue.value || null,
    duration_unit: els.durationUnit.value || null,
    duration_text: els.durationText.value,
    description: els.description.value,
  };

  try {
    if (state.editingId) {
      await api(`/api/content/${state.editingId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      showToast(`Contenido #${state.editingId} actualizado.`);
    } else {
      const result = await api("/api/content", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      showToast(`Contenido #${result.content.id} registrado.`);
    }

    hideForm();
    await loadContent();
  } catch (error) {
    const details = error.details ? Object.values(error.details).join(" ") : "";
    showMessage(details || error.message);
  } finally {
    els.saveBtn.disabled = false;
  }
}

async function handleDelete(id) {
  if (!window.confirm("¿Eliminar este contenido?")) return;

  try {
    await api(`/api/content/${id}`, { method: "DELETE" });
    showToast(`Contenido #${id} eliminado.`);
    if (state.page > 1 && state.rows.length === 1) {
      state.page -= 1;
    }
    await loadContent();
  } catch (error) {
    showToast(error.message);
  }
}

async function runWorker() {
  els.workerBtn.disabled = true;
  els.workerResult.textContent = "Ejecutando Worker Thread...";
  els.workerResult.classList.remove("hidden");

  try {
    const data = await api("/api/stats/worker");
    const stats = data.stats;
    els.workerResult.textContent =
      `Hilo principal: #${data.mainThreadId} | Worker Thread: #${stats.workerThreadId} | ` +
      `${formatNumber(data.rowsSentToWorker)} registros | ${data.elapsedMs} ms ` +
      `(worker: ${stats.workerElapsedMs} ms)`;
    showToast(`Worker #${stats.workerThreadId} ejecutado correctamente.`);
  } catch (error) {
    els.workerResult.textContent = `Error al ejecutar el Worker: ${error.message}`;
  } finally {
    els.workerBtn.disabled = false;
  }
}

let searchTimer;
els.search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = els.search.value.trim();
    state.page = 1;
    loadContent();
  }, 300);
});

els.typeFilter.addEventListener("change", () => {
  state.type = els.typeFilter.value;
  state.page = 1;
  loadContent();
});

els.pageSize.addEventListener("change", () => {
  state.pageSize = Number(els.pageSize.value);
  state.page = 1;
  loadContent();
});

els.prev.addEventListener("click", () => {
  if (state.page > 1) {
    state.page -= 1;
    loadContent();
  }
});

els.next.addEventListener("click", () => {
  if (state.page < state.totalPages) {
    state.page += 1;
    loadContent();
  }
});

els.form.addEventListener("submit", handleSubmit);
els.createBtn.addEventListener("click", showCreateForm);
els.workerBtn.addEventListener("click", runWorker);
els.closeFormBtn.addEventListener("click", hideForm);
els.cancelBtn.addEventListener("click", hideForm);

els.tbody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = Number(button.dataset.id);
  if (button.dataset.action === "edit") startEdit(id);
  if (button.dataset.action === "delete") handleDelete(id);
});

const socket = io();

socket.on("connect", () => {
  state.socketId = socket.id;
  els.wsStatus.textContent = "Tiempo real conectado";
  els.wsStatus.classList.remove("bad");
  els.wsStatus.classList.add("ok");
});

socket.on("disconnect", () => {
  state.socketId = null;
  els.wsStatus.textContent = "Tiempo real desconectado";
  els.wsStatus.classList.remove("ok");
  els.wsStatus.classList.add("bad");
});

Object.entries({
  "content:created": "otro cliente registró un contenido",
  "content:updated": "otro cliente editó un contenido",
  "content:deleted": "otro cliente eliminó un contenido",
}).forEach(([eventName, message]) => {
  socket.on(eventName, (payload) => {
    if (payload.actorId && payload.actorId === socket.id) return;
    showToast(`Actualización en tiempo real: ${message}.`);
    loadContent();
  });
});

resetForm();
loadHealth();
loadContent();
