function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeTenantSettings(value) {
  if (!isPlainObject(value)) {
    return {};
  }

  return { ...value };
}

function mergeNestedObject(previousValue, nextValue) {
  const previous = isPlainObject(previousValue) ? previousValue : {};
  const next = isPlainObject(nextValue) ? nextValue : {};

  return {
    ...previous,
    ...next,
  };
}

function mergeTenantSettingsPatch(currentSettings, incomingSettings) {
  const current = normalizeTenantSettings(currentSettings);

  if (incomingSettings === undefined) {
    return current;
  }

  if (!isPlainObject(incomingSettings)) {
    return incomingSettings;
  }

  const next = { ...current };

  for (const [key, value] of Object.entries(incomingSettings)) {
    if (["labels", "ui", "reminders", "activities", "workflow"].includes(key)) {
      next[key] = mergeNestedObject(current[key], value);
      continue;
    }

    next[key] = value;
  }

  return next;
}

module.exports = {
  isPlainObject,
  mergeTenantSettingsPatch,
  normalizeTenantSettings,
};
