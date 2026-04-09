# PIANO OPZIONE 2 - FRONTEND STATO FATTURE

Data: `02 Aprile 2026`  
Ambito: `HALO frontend`  
Vincolo: questo piano definisce solo interventi UX/frontend. Nessuna modifica backend o DB.

## 1) Obiettivo
Eliminare l'ambiguita nella sezione Fatture dove l'utente puo vedere "Da pagare" anche quando il pagamento Stripe e gia stato confermato, distinguendo chiaramente:
1. stato reale fattura (fonte backend),
2. stato locale bozza (preview form),
3. stato transitorio Stripe (link/open/in attesa).

## 2) Risultato atteso
Al termine:
1. la UI non mostra piu informazioni contrastanti nella stessa vista;
2. lo stato principale mostrato in tabella riflette sempre `fattura.stato` dal backend;
3. le informazioni di bozza non vengono interpretate come stato ufficiale.

## 3) Scope tecnico
File primario:
1. `frontend/src/features/fatture/fatture-creator.tsx`

File di supporto (solo se serve rifinitura copy/typing):
1. `frontend/src/features/fatture/api.ts` (tipi e naming, senza cambiare API),
2. `frontend/src/components/feedback/confirm-dialog.tsx` (solo testo/uso, se necessario).

Non in scope:
1. webhook Stripe,
2. route backend,
3. query SQL o riconciliazione dati.

## 4) Diagnosi sintetica (perche si percepisce il problema)
Nel componente Fatture convivono almeno due livelli:
1. `draft.stato` (stato bozza locale di creazione),
2. `fattura.stato` (stato reale da backend).

Se l'utente osserva la card bozza e non la riga tabella, puo interpretare "Da pagare" come stato ufficiale anche dopo pagamento.

## 5) Strategia di soluzione (UX)
Applicare una gerarchia visiva netta:
1. lo stato ufficiale deve apparire una sola volta in modo dominante (tabella fatture),
2. la card bozza deve essere etichettata esplicitamente come "riepilogo inserimento",
3. i testi devono chiarire che la bozza non rappresenta lo stato aggiornato via webhook.

## 6) Piano step-by-step

### Step 1 - Definire i testi ufficiali
Obiettivo:
1. fissare copy coerente su tutta la pagina.

Azione:
1. introdurre etichette fisse:
   `Stato fattura (backend)` per tabella,
   `Stato selezionato nel form` per card bozza.

Output:
1. lessico univoco, niente "Stato pagamento" ambiguo in card bozza.

---

### Step 2 - Separare semanticamente la card bozza
Obiettivo:
1. evitare che l'utente legga la bozza come stato ufficiale.

Azione:
1. rinominare titolo/card in `Riepilogo ultima creazione`;
2. aggiungere nota fissa:
   `Valore di inserimento. Lo stato ufficiale e quello nella tabella fatture.`
3. de-enfatizzare visivamente il badge bozza (stile secondario).

Output:
1. la card resta utile, ma non compete con il dato backend.

---

### Step 3 - Rafforzare lo stato ufficiale in tabella
Obiettivo:
1. rendere la tabella l'unica fonte di verita per "Pagata/Da pagare".

Azione:
1. intestazione colonna: `Stato fattura (backend)`;
2. mantenere badge netto `Pagata`/`Da pagare` su `fattura.stato`;
3. mantenere colonna Stripe separata (`Pagamento Stripe`) come stato tecnico.

Output:
1. distinzione chiara tra stato gestionale e stato Stripe.

---

### Step 4 - Gestire lo stato post-redirect Stripe
Obiettivo:
1. ridurre finestra di incertezza dopo ritorno da checkout.

Azione:
1. quando URL contiene `?stripe=success`, mostrare messaggio:
   `Pagamento ricevuto. Verifica allineamento stato fattura...`;
2. al completamento refresh/polling mostrare:
   `Stato fattura aggiornato in tabella.`
3. se timeout: messaggio neutro, non contraddittorio:
   `Pagamento registrato, aggiornamento stato in corso.`

Output:
1. nessun messaggio che contraddice la tabella.

---

### Step 5 - Revisione accessibilita e coerenza visuale
Obiettivo:
1. evitare mismatch percettivo su mobile/desktop.

Azione:
1. verificare ordine blocchi su mobile: tabella (o riepilogo stato ufficiale) prima della card bozza;
2. verificare contrasto badge e testi esplicativi;
3. verificare che i messaggi success/error non restino "stale" oltre il contesto.

Output:
1. UX coerente su tutte le viewport.

## 7) Checklist tecnica di implementazione
Eseguire in ordine:
1. aggiornare copy statico del componente Fatture,
2. aggiornare label colonna stato tabella,
3. aggiornare titolo/note card bozza,
4. verificare messaging post-Stripe,
5. lint del file:
   `npm.cmd run lint -- src/features/fatture/fatture-creator.tsx`

## 8) Test plan (manuale)

Scenario A - Creazione fattura da pagare:
1. creare fattura con stato `da_pagare`;
2. verificare che card mostri `Stato selezionato nel form`;
3. verificare che tabella mostri `Stato fattura (backend): Da pagare`.

Scenario B - Pagamento Stripe completato:
1. aprire link Stripe e completare pagamento;
2. tornare su `/fatture?stripe=success...`;
3. verificare messaggio di allineamento;
4. verificare che tabella passi a `Pagata`;
5. verificare che eventuale card bozza non venga interpretata come stato ufficiale.

Scenario C - Nessun pagamento:
1. ricaricare pagina senza parametri Stripe;
2. verificare assenza di messaggi transitori;
3. verificare coerenza testi/label.

## 9) Criteri di accettazione
Il piano e considerato completato quando:
1. in pagina non esiste un punto che possa essere letto come "stato ufficiale" diverso dalla tabella;
2. utente non confonde `draft` con `fattura.stato`;
3. in test manuale B la lettura finale e univoca: `Pagata` in tabella.

## 10) Rischi residui
1. se webhook non arriva, la UI resta corretta ma lo stato backend non cambia;
2. eventuali latenze rete possono ritardare aggiornamento, ma senza copy contraddittorio.

## 11) Rollback (solo UX)
Se la modifica non piace:
1. ripristinare copy precedente,
2. mantenere comunque rinomina minima di sicurezza su card bozza (`stato form`) per evitare regressione percettiva.

## 12) Decisioni rapide da prendere prima dell'implementazione
1. mantenere la card bozza oppure rimuoverla del tutto?
2. su mobile, mettere tabella stato prima della card bozza?
3. usare etichetta finale `Stato fattura (backend)` oppure `Stato ufficiale`?

