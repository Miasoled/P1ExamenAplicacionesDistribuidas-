const CONTENT_TYPES = ["MOVIE", "TV_SHOW", "OTHER"];
const DURATION_UNITS = ["MINUTES", "SEASONS", "OTHER"];
const MAX_DESCRIPTION_LENGTH = 20000;

function asTrimmedString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function parseOptionalInteger(value, errors, field, label, { min, max }) {
  const text = asTrimmedString(value);
  if (text === "") return null;

  if (!/^-?\d+$/.test(text)) {
    errors[field] = `${label} debe ser un número entero.`;
    return null;
  }

  const number = Number(text);
  if (!Number.isSafeInteger(number)) {
    errors[field] = `${label} está fuera de rango.`;
    return null;
  }
  if (min !== undefined && number < min) {
    errors[field] = `${label} debe ser mayor o igual a ${min}.`;
    return null;
  }
  if (max !== undefined && number > max) {
    errors[field] = `${label} debe ser menor o igual a ${max}.`;
    return null;
  }
  return number;
}

function normalizeContent(body = {}) {
  const errors = {};

  const sourceId = asTrimmedString(body.source_id);
  if (!sourceId) {
    errors.source_id = "El identificador de origen es obligatorio.";
  } else if (sourceId.length > 20) {
    errors.source_id = "El identificador de origen admite máximo 20 caracteres.";
  }

  const contentType = asTrimmedString(body.content_type).toUpperCase();
  if (!CONTENT_TYPES.includes(contentType)) {
    errors.content_type = "El tipo debe ser MOVIE, TV_SHOW u OTHER.";
  }

  const title = asTrimmedString(body.title);
  if (!title) {
    errors.title = "El título es obligatorio.";
  } else if (title.length > 500) {
    errors.title = "El título admite máximo 500 caracteres.";
  }

  const dateAddedText = asTrimmedString(body.date_added);
  let dateAdded = null;
  if (dateAddedText !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateAddedText)) {
      errors.date_added = "La fecha debe tener el formato AAAA-MM-DD.";
    } else {
      const parsed = new Date(`${dateAddedText}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) {
        errors.date_added = "La fecha ingresada no es válida.";
      } else {
        dateAdded = dateAddedText;
      }
    }
  }

  const releaseYear = parseOptionalInteger(
    body.release_year,
    errors,
    "release_year",
    "El año de estreno",
    { min: 1800, max: 2100 },
  );

  const rating = asTrimmedString(body.rating) || null;
  if (rating && rating.length > 30) {
    errors.rating = "La clasificación admite máximo 30 caracteres.";
  }

  const durationValue = parseOptionalInteger(
    body.duration_value,
    errors,
    "duration_value",
    "La duración",
    { min: 0, max: 100000 },
  );

  const durationUnit = asTrimmedString(body.duration_unit).toUpperCase() || null;
  if (durationUnit && !DURATION_UNITS.includes(durationUnit)) {
    errors.duration_unit = "La unidad debe ser MINUTES, SEASONS u OTHER.";
  }

  const durationText = asTrimmedString(body.duration_text) || null;
  if (durationText && durationText.length > 50) {
    errors.duration_text = "El texto de duración admite máximo 50 caracteres.";
  }

  const description = asTrimmedString(body.description) || null;
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `La descripción admite máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`;
  }

  return {
    errors,
    value: {
      source_id: sourceId,
      content_type: contentType,
      title,
      date_added: dateAdded,
      release_year: releaseYear,
      rating,
      duration_value: durationValue,
      duration_unit: durationUnit,
      duration_text: durationText,
      description,
    },
  };
}

module.exports = {
  CONTENT_TYPES,
  DURATION_UNITS,
  normalizeContent,
};
