const ALLOWED_TOP_LEVEL_SETTINGS = new Set([
  "product_name",
  "labels",
  "roles",
  "ui",
  "reminders",
  "activities",
]);

const ALLOWED_LABEL_KEYS = new Set([
  "client_singular",
  "client_plural",
  "owner_singular",
  "owner_plural",
  "appointment_singular",
  "appointment_plural",
  "invoice_singular",
  "invoice_plural",
  "inventory_singular",
  "inventory_plural",
]);

const ALLOWED_ROLE_KEYS = new Set(["ADMIN", "DENTISTA", "SEGRETARIO", "DIPENDENTE"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pushError(errors, path, message) {
  errors.push({ path, message });
}

function validateLabels(value, errors) {
  if (!isPlainObject(value)) {
    pushError(errors, "settings.labels", "Deve essere un oggetto.");
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (!ALLOWED_LABEL_KEYS.has(key)) {
      pushError(errors, `settings.labels.${key}`, "Chiave label non supportata.");
      continue;
    }

    if (typeof entry !== "string" || entry.trim().length < 2 || entry.trim().length > 80) {
      pushError(errors, `settings.labels.${key}`, "Deve essere una stringa di 2-80 caratteri.");
    }
  }
}

function validateRoles(value, errors) {
  if (!Array.isArray(value)) {
    pushError(errors, "settings.roles", "Deve essere un array.");
    return;
  }

  for (const [index, entry] of value.entries()) {
    const normalized = typeof entry === "string" ? entry.trim().toUpperCase() : "";
    if (!ALLOWED_ROLE_KEYS.has(normalized)) {
      pushError(errors, `settings.roles[${index}]`, "Ruolo non supportato.");
    }
  }
}

function validateUi(value, errors) {
  if (!isPlainObject(value)) {
    pushError(errors, "settings.ui", "Deve essere un oggetto.");
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (!["dense_mode", "show_financial_kpis"].includes(key)) {
      pushError(errors, `settings.ui.${key}`, "Chiave UI non supportata.");
      continue;
    }

    if (typeof entry !== "boolean") {
      pushError(errors, `settings.ui.${key}`, "Deve essere boolean.");
    }
  }
}

function validateReminders(value, errors) {
  if (!isPlainObject(value)) {
    pushError(errors, "settings.reminders", "Deve essere un oggetto.");
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (!["appointments_enabled", "recall_enabled"].includes(key)) {
      pushError(errors, `settings.reminders.${key}`, "Chiave reminder non supportata.");
      continue;
    }

    if (typeof entry !== "boolean") {
      pushError(errors, `settings.reminders.${key}`, "Deve essere boolean.");
    }
  }
}

function validateActivities(value, errors) {
  if (!isPlainObject(value)) {
    pushError(errors, "settings.activities", "Deve essere un oggetto.");
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key !== "primary_rgb") {
      pushError(errors, `settings.activities.${key}`, "Chiave attivita non supportata.");
      continue;
    }

    if (!isPlainObject(entry)) {
      pushError(errors, "settings.activities.primary_rgb", "Deve essere un oggetto RGB.");
      continue;
    }

    for (const channel of ["r", "g", "b"]) {
      const channelValue = entry[channel];
      if (!Number.isInteger(channelValue) || channelValue < 0 || channelValue > 255) {
        pushError(
          errors,
          `settings.activities.primary_rgb.${channel}`,
          "Deve essere un intero tra 0 e 255.",
        );
      }
    }

    for (const extraKey of Object.keys(entry)) {
      if (!["r", "g", "b"].includes(extraKey)) {
        pushError(
          errors,
          `settings.activities.primary_rgb.${extraKey}`,
          "Canale RGB non supportato.",
        );
      }
    }
  }
}

function validateTenantSettings(settings) {
  const errors = [];

  if (!isPlainObject(settings)) {
    pushError(errors, "settings", "Il payload settings deve essere un oggetto JSON.");
    return {
      valid: false,
      errors,
    };
  }

  for (const [key, value] of Object.entries(settings)) {
    if (!ALLOWED_TOP_LEVEL_SETTINGS.has(key)) {
      pushError(errors, `settings.${key}`, "Chiave configurazione non supportata.");
      continue;
    }

    if (key === "product_name") {
      if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 80) {
        pushError(errors, "settings.product_name", "Deve essere una stringa di 2-80 caratteri.");
      }
      continue;
    }

    if (key === "labels") {
      validateLabels(value, errors);
      continue;
    }

    if (key === "roles") {
      validateRoles(value, errors);
      continue;
    }

    if (key === "ui") {
      validateUi(value, errors);
      continue;
    }

    if (key === "reminders") {
      validateReminders(value, errors);
      continue;
    }

    if (key === "activities") {
      validateActivities(value, errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  validateTenantSettings,
};
