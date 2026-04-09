# STATO OPERATIVO STRIPE - PASSI E PROBLEMI (HALO)

Data aggiornamento: `01 Aprile 2026`  
Ambito: integrazione Stripe su flusso fatture HALO

## 1) Scopo del documento
Questo documento riassume:
1. i passaggi operativi previsti,
2. lo stato reale di completamento,
3. i problemi software rilevati,
4. lo scopo tecnico di ogni intervento residuo,
5. la sequenza step-by-step per chiudere le attività in modo ordinato.

## 2) Passaggi operativi (stato)
### Step 1 - Applicare schema DB
Scopo: allineare tabelle/colonne Stripe (`fatture`, `fatture_pagamenti`) e indici.
Stato: `COMPLETATO`.

### Step 2 - Configurare variabili Stripe backend
Scopo: abilitare creazione sessioni checkout e verifica firma webhook.
Stato: `COMPLETATO`.
Nota: verificare sempre che i segreti usati siano coerenti con ambiente `test` o `live`.

### Step 3 - Configurare webhook `/stripe/webhook`
Scopo: ricevere eventi Stripe e aggiornare automaticamente lo stato fattura.
Stato: `COMPLETATO`.
Nota operativa: il `whsec_...` può cambiare se viene riavviato `stripe listen` locale; aggiornare `backend/.env` quando necessario.

### Step 4 - Collaudo E2E + audit SQL
Scopo: verificare end-to-end creazione link, pagamento, webhook e persistenza dati.
Stato: `COMPLETATO CON ATTENZIONE`.

## 3) Problemi software rilevati
### Problema A - Evento storico `generated` non sempre visibile
Impatto:
1. storico pagamenti potenzialmente incompleto,
2. tracciamento operativo meno affidabile in audit.

Scopo fix:
1. garantire che ogni `POST /fatture/:id/stripe-link` riuscito registri evento `generated`,
2. evitare buchi nello storico.

### Problema B - Record legacy incoerenti in `fatture`
Descrizione:
1. presenti fatture con `stato='pagata'` ma `stripe_status <> 'paid'`.

Impatto:
1. KPI e report pagamento non pienamente coerenti,
2. possibile confusione in dashboard amministrativa.

Scopo fix:
1. riallineare dati storici con una procedura controllata,
2. ridurre incoerenze funzionali in report e audit.

### Problema C - Rischio mismatch ambiente Stripe (`test/live`)
Descrizione:
1. uso misto di chiavi o webhook secret di ambienti diversi.

Impatto:
1. errori 4xx/5xx lato Stripe,
2. webhook non validati (firma non valida).

Scopo fix:
1. imporre check operativo pre-release su coerenza chiavi/segreti/modalità.

## 4) Step residui da fare (priorità operativa)
### Step 5 - Verifica tecnica logging `generated`
Obiettivo:
1. riprodurre caso con test mirato,
2. confermare inserimento in `fatture_pagamenti`,
3. se necessario, patchare endpoint `POST /fatture/:id/stripe-link`.

Output atteso:
1. per ogni link creato: evento `generated` presente.
Stato: `COMPLETATO`.

### Step 6 - Bonifica dati legacy incoerenti
Obiettivo:
1. identificare righe con `stato='pagata' AND stripe_status<>'paid'`,
2. classificare se pagamento Stripe reale o pagamento gestionale manuale,
3. aggiornare `stripe_status` secondo regola condivisa (es. `paid` o `manual`).

Output atteso:
1. zero incoerenze non giustificate.
Stato: `COMPLETATO`.

### Step 7 - Hardening operativo ambiente
Obiettivo:
1. checklist pre-go-live su coerenza `test/live`,
2. verifica webhook secret attivo,
3. esecuzione audit SQL finale.

Output atteso:
1. runbook eseguibile senza ambiguità e rilascio stabile.
Stato: `COMPLETATO CON ATTENZIONE CONFIGURATIVA`.
Nota:
1. ambiente locale attuale con `STRIPE_SECRET_KEY` live e URL checkout localhost da riallineare secondo target.

## 5) Sequenza consigliata di chiusura (step-by-step)
1. Eseguire Step 5 (`generated`) e confermare fix con test dedicato.
2. Eseguire Step 6 (bonifica incoerenze legacy) con query tracciate.
3. Eseguire Step 7 (hardening operativo) e rieseguire audit completo.
4. Salvare report finale di validazione e chiudere la release.

## 6) Criterio di completamento finale
L’integrazione Stripe può essere considerata chiusa quando:
1. i 4 passaggi base risultano completati (già fatto),
2. lo storico eventi include correttamente `generated` e `paid`,
3. le incoerenze legacy sono risolte o classificate formalmente,
4. audit SQL finale non evidenzia anomalie bloccanti.
