# Fase 0 - Allineamento Funzionale Dashboard

Stato: completata  
Data: 2026-04-06  
Timezone di riferimento: `Europe/Rome`

## Obiettivo della fase
Bloccare le regole funzionali definitive prima delle modifiche tecniche su:
1. curva grafico revenue (meno spigolosa)
2. KPI appuntamenti futuri reali
3. gestione reale dell'intervallo temporale del grafico

## Baseline tecnica verificata
- Dashboard attuale: `/Users/francescostrano/Desktop/HALO/frontend/src/app/dashboard/page.tsx`
- API guadagni: `/Users/francescostrano/Desktop/HALO/frontend/src/features/dashboard/api.ts`
- API appuntamenti: `/Users/francescostrano/Desktop/HALO/frontend/src/features/agenda/api.ts`
- Stati appuntamento disponibili:
  - `in_attesa`
  - `confermato`
  - `completato`
  - `annullato`

## Decisioni funzionali congelate

## 1) Definizione ufficiale "appuntamenti ancora da avvenire"
Un appuntamento e conteggiato nel KPI "da svolgere" solo se:
1. `appointment_datetime >= now` (orario locale `Europe/Rome`)
2. stato in `{in_attesa, confermato}`
3. stato escluso `{completato, annullato}`

Regole aggiuntive:
1. Se la data e valida ma l'ora e assente/non parsabile, il record non entra nel KPI.
2. A parita di timestamp con `now`, l'appuntamento e considerato ancora da svolgere.

## 2) Intervalli grafico supportati
Preset obbligatori:
1. `7d`
2. `14d`
3. `30d`
4. `90d`
5. `YTD`

Custom range obbligatorio:
1. `date_from` + `date_to` (formato `YYYY-MM-DD`)

Regole:
1. `date_from <= date_to`
2. range massimo consentito: `365` giorni
3. default dashboard: `30d`

## 3) Granularita dati grafico
1. `day` per range fino a 90 giorni
2. `week` per range > 90 e <= 365 giorni
3. `month` opzionale per viste aggregate annuali (YTD esteso)

## 4) Curva grafico "meno a punta"
Algoritmo target:
1. curva `monotone cubic` (o Catmull-Rom con clamp anti-overshoot)

Vincoli:
1. mantenere monotonia locale dei dati (no oscillazioni artificiali)
2. nessun punto renderizzato fuori area chart
3. area fill coerente alla curva (non alla vecchia polilinea)

## Casi limite da coprire (QA obbligatorio)
1. Range senza dati: grafico vuoto con placeholder, nessun errore JS.
2. Un solo punto dati: visualizzazione valida senza path corrotto.
3. Cambio range rapido: niente race condition/flash incoerente.
4. Appuntamenti su cambio giorno (23:59 -> 00:00): KPI coerente.
5. Timezone locale browser diversa da server: conteggio coerente con `Europe/Rome`.

## Criteri di accettazione Fase 0
1. Definizioni sopra approvate e non ambigue.
2. Stati appuntamento e regole KPI allineati ai tipi reali presenti nel codice.
3. Set intervalli e validazioni congelati per implementazione Fasi successive.

Esito: `SUPERATO`
