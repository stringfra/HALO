const { pool } = require("../config/db");
const { getEntityDisplayName } = require("./labels.service");

const reminderEligibleStates = new Set(["confermato", "in_attesa"]);

function safeDaysAhead(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return Math.min(parsed, 30);
}

function normalizeRecipient(patient) {
  if (patient.telefono) {
    return { channel: "telefono", target: patient.telefono };
  }
  if (patient.email) {
    return { channel: "email", target: patient.email };
  }
  return { channel: "nessun_contatto", target: null };
}

function composeMockMessage(appointment, patientName, ownerLabel) {
  return `Promemoria mock: appuntamento per ${patientName} il ${appointment.data} alle ${appointment.ora} con ${ownerLabel} ${appointment.medico}.`;
}

async function generateAppointmentReminders({ studioId, daysAhead = 1, labels = {} } = {}) {
  const normalizedDays = safeDaysAhead(daysAhead);
  if (normalizedDays === null) {
    const error = new Error("Parametro daysAhead non valido.");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `SELECT a.id,
            a.paziente_id,
            TO_CHAR(a.data, 'DD MM YYYY') AS data,
            a.ora,
            a.medico,
            a.stato,
            p.nome,
            p.cognome,
            p.telefono,
            p.email
     FROM appuntamenti a
     LEFT JOIN pazienti p ON p.id = a.paziente_id
     WHERE a.data >= CURRENT_DATE
       AND ($3::bigint IS NULL OR a.studio_id = $3::bigint)
       AND a.data <= (CURRENT_DATE + $1::int)
       AND a.stato = ANY($2::text[])
     ORDER BY a.data ASC, a.ora ASC, a.id ASC`,
    [normalizedDays, Array.from(reminderEligibleStates), studioId || null],
  );

  const ownerLabel = labels.owner_singular || "Responsabile";
  const clientLabel = getEntityDisplayName(labels, "clients");

  const reminders = result.rows.map((row) => {
    const patientName =
      `${row.nome ?? ""} ${row.cognome ?? ""}`.trim() || `${clientLabel} #${row.paziente_id}`;
    const recipient = normalizeRecipient(row);

    return {
      appointmentId: row.id,
      patientId: row.paziente_id,
      patientName,
      date: row.data,
      time: row.ora,
      medico: row.medico,
      stato: row.stato,
      recipient,
      message: composeMockMessage(
        { data: row.data, ora: row.ora, medico: row.medico },
        patientName,
        ownerLabel,
      ),
      simulated: true,
    };
  });

  return {
    mode: "mock",
    daysAhead: normalizedDays,
    generatedAt: new Date().toISOString(),
    total: reminders.length,
    reminders,
  };
}

module.exports = {
  generateAppointmentReminders,
};
