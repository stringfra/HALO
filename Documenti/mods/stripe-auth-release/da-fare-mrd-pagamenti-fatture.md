# MRD – Integrazione Stripe per Pagamenti da Fattura Gestionale
Versione: `v1.0`  
Data: `1 Aprile 2026`  
Stato: `Draft operativo`  
Nota: `nessuna modifica al codice eseguita`  

## 1. Contesto
Nel gestionale HALO esiste già la creazione di fatture non fiscali. Serve aggiungere un flusso opzionale che, subito dopo il salvataggio fattura, proponga all’operatore la generazione di un link Stripe per consentire il pagamento al paziente.

## 2. Obiettivo prodotto
Consentire a `ADMIN` e `SEGRETARIO` di:
1. Salvare la fattura gestionale.
2. Ricevere un popup: “Vuoi generare un link di pagamento Stripe?”
3. Generare e copiare/condividere il link pagamento con il paziente.

## 3. Obiettivi business
1. Ridurre i tempi di incasso delle fatture “da pagare”.
2. Tracciare in modo affidabile stato link e stato pagamento.
3. Ridurre errori manuali tra importo fattura e importo incassato.

## 4. Scope MVP
1. Popup post-salvataggio fattura con scelta `Genera link` / `Non ora`.
2. Creazione sessione pagamento Stripe con importo fattura.
3. Salvataggio riferimento Stripe e URL nel database.
4. Webhook Stripe per aggiornare automaticamente lo stato fattura a `pagata`.
5. Visualizzazione stato link pagamento in area fatture.

## 5. Fuori scope (MVP)
1. Fatturazione fiscale/elettronica.
2. Rateizzazione.
3. Rimborsi automatici.
4. Solleciti automatici multi-canale avanzati.

## 6. Requisiti funzionali
1. `FR-01` Dopo creazione fattura con stato `da_pagare`, mostrare popup di conferma generazione link Stripe.
2. `FR-02` Se operatore seleziona “Genera link”, backend crea sessione pagamento Stripe con metadati `fattura_id`, `paziente_id`, `studio_id`.
3. `FR-03` Se operatore seleziona “Non ora”, nessuna chiamata Stripe.
4. `FR-04` Il link generato deve essere visualizzato subito con azione copia.
5. `FR-05` A pagamento confermato via webhook, fattura passa a `pagata`.
6. `FR-06` Se fattura è già `pagata`, la generazione link deve essere bloccata.
7. `FR-07` Deve esistere storico minimo degli eventi pagamento (generato, pagato, scaduto, fallito).

## 7. Requisiti non funzionali
1. Sicurezza: chiavi Stripe in variabili ambiente, mai esposte nel frontend.
2. Integrità: verifica firma webhook Stripe obbligatoria.
3. Idempotenza: evitare duplicati link su retry.
4. Performance: creazione link percepita < 3 secondi in condizioni normali.
5. Audit: log con request id e riferimenti fattura/link.

## 8. UX richiesta popup
Titolo: `Generare link di pagamento Stripe?`  
Testo: `La fattura è stata salvata. Vuoi creare ora un link di pagamento da inviare al paziente?`  
CTA primaria: `Genera link`  
CTA secondaria: `Non ora`  
Esito positivo: mostra URL + pulsante `Copia link`  
Esito errore: messaggio chiaro con possibilità di riprovare

## 9. Proposta tecnica (alto livello)
1. Endpoint backend: `POST /fatture/:id/stripe-link` (protetto da token + ruoli).
2. Endpoint webhook: `POST /stripe/webhook`.
3. Estensione dati:
- Opzione A: colonne su `fatture` (`stripe_session_id`, `stripe_payment_link`, `stripe_status`, `stripe_generated_at`).
- Opzione B consigliata: tabella separata `fatture_pagamenti` per storico eventi e più tentativi.
4. Frontend:
- Dopo `createFattura` andata a buon fine, aprire popup.
- In caso conferma, chiamare endpoint link e mostrare risultato nel pannello fattura.

## 10. Regole business
1. Link generabile solo per fatture `da_pagare`.
2. Importo Stripe deve combaciare con importo fattura al momento della generazione.
3. Se importo fattura cambia dopo link generato, link precedente va invalidato o marcato obsoleto.
4. Un pagamento Stripe completato aggiorna stato fattura una sola volta.

## 11. KPI di successo
1. `% fatture da_pagare con link generato`.
2. `Tempo medio incasso` prima/dopo integrazione.
3. `% pagamenti conclusi via link`.
4. `% errori creazione link` e `% webhook falliti`.

## 12. Acceptance criteria (MVP)
1. Creata fattura `da_pagare` -> popup visibile.
2. Click `Non ora` -> nessun record Stripe creato.
3. Click `Genera link` -> URL valido restituito e salvato.
4. Pagamento completato su Stripe -> fattura aggiornata a `pagata`.
5. Fattura `pagata` -> popup/link non disponibili.
6. Retry webhook non crea aggiornamenti duplicati.

Se vuoi, nel prossimo step posso trasformare questo MRD in una checklist tecnica sprint-ready (task backend/frontend/database/test) già ordinata per priorità.
