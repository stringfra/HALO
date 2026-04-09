const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mergeTenantSettingsPatch,
  normalizeTenantSettings,
} = require("../src/services/tenant-settings.service");

test("normalizeTenantSettings returns an empty object for non objects", () => {
  assert.deepEqual(normalizeTenantSettings(null), {});
  assert.deepEqual(normalizeTenantSettings([]), {});
  assert.deepEqual(normalizeTenantSettings("x"), {});
});

test("mergeTenantSettingsPatch preserves existing top level settings on partial update", () => {
  const current = {
    product_name: "HALO Dental",
    roles: ["ADMIN", "SEGRETARIO", "DIPENDENTE"],
    labels: {
      client_singular: "Paziente",
      owner_singular: "Dentista",
    },
    activities: {
      primary_rgb: {
        r: 15,
        g: 118,
        b: 110,
      },
    },
  };

  const next = mergeTenantSettingsPatch(current, {
    labels: {
      owner_singular: "Medico",
    },
  });

  assert.deepEqual(next, {
    product_name: "HALO Dental",
    roles: ["ADMIN", "SEGRETARIO", "DIPENDENTE"],
    labels: {
      client_singular: "Paziente",
      owner_singular: "Medico",
    },
    activities: {
      primary_rgb: {
        r: 15,
        g: 118,
        b: 110,
      },
    },
  });
});

test("mergeTenantSettingsPatch deep merges activities updates", () => {
  const current = {
    activities: {
      primary_rgb: {
        r: 15,
        g: 118,
        b: 110,
      },
      extra_flag: true,
    },
    reminders: {
      appointments_enabled: true,
    },
  };

  const next = mergeTenantSettingsPatch(current, {
    activities: {
      primary_rgb: {
        r: 1,
        g: 2,
        b: 3,
      },
    },
  });

  assert.deepEqual(next, {
    activities: {
      primary_rgb: {
        r: 1,
        g: 2,
        b: 3,
      },
      extra_flag: true,
    },
    reminders: {
      appointments_enabled: true,
    },
  });
});
