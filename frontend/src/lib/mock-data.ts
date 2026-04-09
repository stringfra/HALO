import { formatDateToDmy } from "./date-utils";

export type MockPatient = {
  id: string;
  nomeCompleto: string;
  telefono: string;
  email: string;
  ultimaVisita: string;
};

export type MockAppointment = {
  id: string;
  paziente: string;
  data: string;
  ora: string;
  medico: string;
  stato: "Confermato" | "In attesa" | "Completato";
};

export type MockInvoice = {
  id: string;
  paziente: string;
  importo: number;
  stato: "Pagata" | "Da pagare";
  data: string;
};

export type MockProduct = {
  id: string;
  nome: string;
  quantita: number;
  sogliaMinima: number;
};

export type MockRevenuePoint = {
  data: string;
  entrate: number;
};

export const mockPatients: MockPatient[] = [
  {
    id: "PAZ-001",
    nomeCompleto: "Mario Rossi",
    telefono: "+39 333 000 1010",
    email: "mario.rossi@email.it",
    ultimaVisita: "18 03 2026",
  },
  {
    id: "PAZ-002",
    nomeCompleto: "Giulia Bianchi",
    telefono: "+39 333 000 2020",
    email: "giulia.bianchi@email.it",
    ultimaVisita: "27 03 2026",
  },
  {
    id: "PAZ-003",
    nomeCompleto: "Luca Verdi",
    telefono: "+39 333 000 3030",
    email: "luca.verdi@email.it",
    ultimaVisita: "12 03 2026",
  },
];

export const mockAppointments: MockAppointment[] = [
  {
    id: "APP-1000",
    paziente: "Mario Rossi",
    data: "30 03 2026",
    ora: "18:30",
    medico: "Dr. Ferri",
    stato: "Completato",
  },
  {
    id: "APP-1001",
    paziente: "Mario Rossi",
    data: "31 03 2026",
    ora: "09:00",
    medico: "Dr.ssa Conti",
    stato: "Confermato",
  },
  {
    id: "APP-1002",
    paziente: "Giulia Bianchi",
    data: "31 03 2026",
    ora: "10:30",
    medico: "Dr. Ferri",
    stato: "In attesa",
  },
  {
    id: "APP-1003",
    paziente: "Luca Verdi",
    data: "01 04 2026",
    ora: "16:00",
    medico: "Dr.ssa Conti",
    stato: "Confermato",
  },
];

export const mockInvoices: MockInvoice[] = [
  {
    id: "FAT-450",
    paziente: "Mario Rossi",
    importo: 120,
    stato: "Pagata",
    data: "28 03 2026",
  },
  {
    id: "FAT-451",
    paziente: "Giulia Bianchi",
    importo: 80,
    stato: "Da pagare",
    data: "29 03 2026",
  },
  {
    id: "FAT-452",
    paziente: "Luca Verdi",
    importo: 210,
    stato: "Pagata",
    data: "30 03 2026",
  },
];

export const mockProducts: MockProduct[] = [
  { id: "PRD-001", nome: "Guanti nitrile M", quantita: 140, sogliaMinima: 50 },
  { id: "PRD-002", nome: "Mascherine FFP2", quantita: 60, sogliaMinima: 40 },
  { id: "PRD-003", nome: "Anestetico locale", quantita: 14, sogliaMinima: 20 },
];

const revenueSeed = [
  0, 120, 90, 180, 240, 170, 220, 160, 280, 210, 190, 320, 260, 140, 330, 150,
  360, 210, 180, 310, 230, 260, 340, 170, 220, 300, 190, 250, 290, 370,
];

export const mockRevenueLast30Days: MockRevenuePoint[] = Array.from(
  { length: 30 },
  (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (29 - index));

    return {
      data: formatDateToDmy(day),
      entrate: revenueSeed[index],
    };
  },
);
