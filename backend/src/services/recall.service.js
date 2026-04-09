const { pool } = require("../config/db");
const { getEntityDisplayName } = require("./labels.service");

function clampInt(value, { min, max, fallback }) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function normalizeChannel(patient) {
  if (patient.telefono) {
    return { channel: "telefono", target: patient.telefono };
  }
  if (patient.email) {
    return { channel: "email", target: patient.email };
  }
  return { channel: "nessun_contatto", target: null };
}

function computePriority(daysSinceLastVisit) {
  if (daysSinceLastVisit === null) {
    return "alta";
  }
  if (daysSinceLastVisit >= 365) {
    return "alta";
  }
  if (daysSinceLastVisit >= 240) {
    return "media";
  }
  return "bassa";
}

function reasonForRecall({ lastVisit, daysSinceLastVisit, thresholdDays, clientLabel }) {
  if (!lastVisit) {
    return `${clientLabel} senza visite registrate: suggerito primo richiamo.`;
  }
  return `Ultima visita ${daysSinceLastVisit} giorni fa (soglia ${thresholdDays}).`;
}

async function generatePatientRecalls({
  studioId,
  labels = {},
  daysWithoutVisit = 180,
  upcomingWindowDays = 30,
  limit = 100,
} = {}) {
  const normalizedDaysWithoutVisit = clampInt(daysWithoutVisit, {
    min: 30,
    max: 730,
    fallback: 180,
  });
  const normalizedUpcomingWindowDays = clampInt(upcomingWindowDays, {
    min: 0,
    max: 180,
    fallback: 30,
  });
  const normalizedLimit = clampInt(limit, {
    min: 1,
    max: 500,
    fallback: 100,
  });

  const query = await pool.query(
    `WITH ultima_visita AS (
       SELECT a.paziente_id, MAX(a.data) AS data_ultima_visita
       FROM appuntamenti a
       WHERE a.stato = 'completato'
       GROUP BY a.paziente_id
     ),
     prossimi_appuntamenti AS (
       SELECT a.paziente_id, MIN(a.data) AS prossima_data
       FROM appuntamenti a
       WHERE a.data >= CURRENT_DATE
         AND a.stato = ANY($2::text[])
       GROUP BY a.paziente_id
     )
     SELECT p.id,
            p.nome,
            p.cognome,
            p.telefono,
            p.email,
            uv.data_ultima_visita,
            pa.prossima_data,
            CASE
              WHEN uv.data_ultima_visita IS NULL THEN NULL
              ELSE (CURRENT_DATE - uv.data_ultima_visita)
            END AS giorni_da_ultima_visita
     FROM pazienti p
     LEFT JOIN ultima_visita uv ON uv.paziente_id = p.id
     LEFT JOIN prossimi_appuntamenti pa ON pa.paziente_id = p.id
     WHERE p.studio_id = $5::bigint
       AND (
       uv.data_ultima_visita IS NULL
       OR uv.data_ultima_visita <= (CURRENT_DATE - $1::int)
     )
       AND (
         pa.prossima_data IS NULL
         OR pa.prossima_data > (CURRENT_DATE + $3::int)
       )
     ORDER BY uv.data_ultima_visita ASC NULLS FIRST, p.id DESC
     LIMIT $4::int`,
    [
      normalizedDaysWithoutVisit,
      ["in_attesa", "confermato"],
      normalizedUpcomingWindowDays,
      normalizedLimit,
      studioId,
    ],
  );

  const clientLabel = getEntityDisplayName(labels, "clients");

  const recalls = query.rows.map((row) => {
    const patientName =
      `${row.nome ?? ""} ${row.cognome ?? ""}`.trim() || `${clientLabel} #${row.id}`;
    const lastVisit = row.data_ultima_visita
      ? new Intl.DateTimeFormat("it-IT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
          .format(new Date(row.data_ultima_visita))
          .replaceAll("/", " ")
      : null;
    const nextAppointment = row.prossima_data
      ? new Intl.DateTimeFormat("it-IT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
          .format(new Date(row.prossima_data))
          .replaceAll("/", " ")
      : null;

    const daysSinceLastVisit =
      row.giorni_da_ultima_visita === null
        ? null
        : Number.parseInt(row.giorni_da_ultima_visita, 10);
    const priority = computePriority(daysSinceLastVisit);
    const recipient = normalizeChannel(row);

    return {
      patientId: row.id,
      patientName,
      lastVisit,
      daysSinceLastVisit,
      nextAppointment,
      priority,
      recipient,
      reason: reasonForRecall({
        lastVisit,
        daysSinceLastVisit,
        thresholdDays: normalizedDaysWithoutVisit,
        clientLabel,
      }),
      suggestedAction: `Inviare richiamo ${recipient.channel} entro 48h.`,
      simulated: true,
    };
  });

  return {
    mode: "logic",
    generatedAt: new Date().toISOString(),
    criteria: {
      daysWithoutVisit: normalizedDaysWithoutVisit,
      upcomingWindowDays: normalizedUpcomingWindowDays,
      limit: normalizedLimit,
    },
    total: recalls.length,
    recalls,
  };
}

module.exports = {
  generatePatientRecalls,
};
