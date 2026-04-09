# Specifica tecnica IA - Implementazione gestionale logistico modulare

Data analisi: 6 aprile 2026  
Ambiente analizzato: repository locale `HALO` (backend + frontend + database)  
Scopo: definire in modo esecutivo cosa va implementato per coprire **tutti** i requisiti richiesti, indicando stato attuale, gap e punti deboli da risolvere.

## 1) Sintesi esecutiva

Il progetto attuale e' un gestionale web multi-tenant con moduli core su clienti/appuntamenti/fatture/magazzino base, RBAC e feature flags.

Per il perimetro logistico richiesto (OMS + WMS avanzato + TMS + reverse logistics + integrazioni e-commerce/corrieri/ERP + forecasting), lo stato complessivo e':

- Copertura piena: **bassa**
- Copertura parziale: **alcuni prerequisiti tecnici gia' presenti**
- Copertura assente: **la maggior parte delle funzionalita' logistiche richieste**

## 2) Evidenze del progetto attuale (base oggettiva)

- Routing backend attuale centrato su clienti/appuntamenti/fatture/prodotti/automazioni: `backend/src/server.js:60-75`
- Entita core DB disponibili come view: `core_clients`, `core_appointments`, `core_invoices`, `core_inventory_items`: `database/schema.sql:731-775`
- Magazzino attuale = CRUD prodotti + sotto soglia (nessuna ubicazione/picking): `backend/src/routes/prodotti.routes.js:38-279`, tabella `prodotti` in `database/schema.sql:223-229`
- Analytics attuale = endpoint guadagni: `backend/src/routes/stats.routes.js:111-139`, servizio `calcolaGuadagni`: `backend/src/services/stats.service.js:204-237`
- Dashboard aggiornata via polling ogni 30s (non streaming live): `frontend/src/app/dashboard/page.tsx:625-633`
- Automazioni presenti ma output simulato: `backend/src/services/reminder.service.js:79-89`, `backend/src/services/recall.service.js:159-173`
- Multi-tenant e modularita via feature flags/RBAC presenti:  
  - `backend/src/config/multi-sector.js:13-24,39-76,78-120`  
  - `backend/src/services/feature-flags.service.js:119-167`  
  - `database/schema.sql:146-193`
- Sicurezza presente su auth e permessi: `backend/middlewares/authMiddleware.js:42-239`, JWT `backend/src/services/auth-context.service.js:98-167`
- Cifratura presente per MFA daemon (AES-256-GCM): `backend/src/services/daemon-mfa.service.js:19-47`
- Verifica firma webhook Stripe (HMAC + timing-safe compare): `backend/src/routes/stripe.routes.js:71-121`
- UI responsive parziale (es. griglie + tabella scroll): `frontend/src/features/magazzino/magazzino-manager.tsx:222-243`, `frontend/src/app/globals.css:290-295`

Verifica assenze specifiche (ricerca testuale su `backend`, `frontend`, `database`): nessuna implementazione concreta individuata per `shopify`, `magento`, `dhl`, `gls`, `sda`, `erp`, `forecast`, `picking`, `warehouse locations`, `barcode/scanner` (match null lato codice funzionale).

## 3) Matrice requisiti richiesta -> stato -> gap

Legenda stato:

- **PRESENTE**
- **PARZIALE**
- **ASSENTE**

### 3.1 Funzionalita core

1. **OMS - Aggregazione automatica ordini da piu' canali**  
   Stato: **ASSENTE**  
   Evidenza: assenza entita/routes ordini/canali in `server.js` e `schema.sql` (core views solo clients/appointments/invoices/inventory).  
   Gap critico: manca dominio ordini multi-canale end-to-end.

2. **OMS - Validazione e normalizzazione dati**  
   Stato: **PARZIALE**  
   Evidenza: validazioni input presenti in moduli esistenti (`prodotti.routes.js`, `stats.routes.js`) e alias dominio (`domain-aliases.service.js`).  
   Gap critico: manca un layer di normalizzazione specifico OMS (mapping SKU, stati ordine, indirizzi, valute, tasse, timezone).

3. **WMS - Gestione ubicazioni**  
   Stato: **ASSENTE**  
   Evidenza: tabella `prodotti` con soli `nome/quantita/soglia_minima` (`schema.sql:223-229`).  
   Gap critico: nessuna struttura location/bin/zone/warehouse.

4. **WMS - Picking ottimizzato (batch, wave picking)**  
   Stato: **ASSENTE**  
   Evidenza: nessuna entita/task/algoritmo picking nel backend.  
   Gap critico: assenza completa del motore operativo di picking.

5. **WMS - Inventario in tempo reale**  
   Stato: **PARZIALE**  
   Evidenza: CRUD inventario + sotto soglia (`prodotti.routes.js`) e UI magazzino.  
   Gap critico: non ci sono eventi di movimento stock, lock concorrenza, stream live, audit di giacenza, riserve stock per ordine.

6. **TMS - Pianificazione tratte**  
   Stato: **ASSENTE**  
   Evidenza: nessun dominio spedizioni/tratte/corrieri.  
   Gap critico: impossibile pianificare consegne.

7. **TMS - Ottimizzazione carichi**  
   Stato: **ASSENTE**  
   Evidenza: assenza modelli colli, peso/volume, capacita mezzo.  
   Gap critico: nessuna ottimizzazione dispatch.

8. **TMS - Tracking spedizioni live**  
   Stato: **ASSENTE**  
   Evidenza: nessuna entita tracking events e nessuna integrazione carrier.  
   Gap critico: nessuna visibilita spedizione.

9. **Gestione resi (Reverse logistics) - Workflow automatizzati**  
   Stato: **ASSENTE**  
   Evidenza: automazioni attuali riguardano reminder/recall sanitari, non resi (`automazioni.routes.js`).  
   Gap critico: mancano RMA, stati reso, regole automatiche, reintegro/scarto.

10. **Gestione resi (Reverse logistics) - Tracciabilita completa**  
    Stato: **ASSENTE**  
    Evidenza: audit log esistono a livello tenant/piattaforma, non per ciclo reso logistico (`schema.sql:231+`).  
    Gap critico: non c'e' una timeline evento-per-evento su resi e movimenti.

### 3.2 Integrazioni

11. **API con piattaforme e-commerce (Shopify, Magento)**  
    Stato: **ASSENTE**  
    Evidenza: nessun connettore o adapter dedicato; nessuna route webhook e-commerce.

12. **Integrazione con corrieri (SDA, DHL, GLS)**  
    Stato: **ASSENTE**  
    Evidenza: nessuna integrazione carrier in backend/database.

13. **ERP e sistemi contabili**  
    Stato: **ASSENTE**  
    Evidenza: presente solo integrazione pagamenti Stripe su fatture (`fatture.routes.js:282+`, `stripe.routes.js`), non ERP/accounting sync.  
    Gap critico: non c'e' allineamento contabile esterno.

### 3.3 Analytics & reporting

14. **Dashboard KPI in tempo reale**  
    Stato: **PARZIALE**  
    Evidenza: dashboard KPI e endpoint stats presenti (`stats.routes.js`, `dashboard/page.tsx`), refresh via polling 30s.  
    Gap critico: assenza KPI logistici OMS/WMS/TMS e assenza streaming/event bus.

15. **Analisi performance per cliente, area geografica, operatore**  
    Stato: **ASSENTE**  
    Evidenza: nessun endpoint/report dedicato a questi breakdown nel modulo stats attuale.

16. **Previsioni domanda (forecasting)**  
    Stato: **ASSENTE**  
    Evidenza: nessun motore forecast, nessuna serie storica dedicata, nessun modello predittivo.

### 3.4 Requisiti tecnici

17. **Cloud SaaS (scalabile)**  
    Stato: **PARZIALE**  
    Evidenza: impostazione multi-tenant e feature flags presente (`tenant_features`, `vertical_templates`, daemon tenant creation).  
    Gap critico: mancano blueprint cloud/HA, autoscaling, ambienti, CI/CD infrastrutturale, observability.

18. **Sicurezza (GDPR, crittografia dati)**  
    Stato: **PARZIALE**  
    Evidenza: JWT+refresh, RBAC, MFA cifrata AES-256-GCM, firma webhook Stripe.  
    Gap critico: manca copertura GDPR completa (consenso, minimizzazione, retention policy, diritto oblio/export, DPIA, registro trattamenti, data lineage PII).

19. **Accesso multi-ruolo**  
    Stato: **PRESENTE**  
    Evidenza: `roles`, `role_permissions`, `user_roles` + middleware `requirePermission` + catalogo permessi.

20. **Alta disponibilita (uptime >99.9%)**  
    Stato: **ASSENTE**  
    Evidenza: nessuna evidenza infrastrutturale/SLO/SLA; non risultano endpoint health/readiness standard o monitoraggio uptime complessivo.

### 3.5 UX/UI

21. **Interfaccia intuitiva per operatori di magazzino**  
    Stato: **PARZIALE**  
    Evidenza: esiste una UI magazzino base CRUD e alert sotto soglia (`magazzino-manager.tsx`).  
    Gap critico: manca UX operativa WMS (picking list, scanner flow, error-proofing, stati task).

22. **Mobile-friendly (tablet/scanner)**  
    Stato: **PARZIALE**  
    Evidenza: responsive base presente (`sm:grid-cols-3`, tabella con `overflow-x:auto`).  
    Gap critico: nessun flusso scanner/barcode, nessuna UX touch-first per workflow di corsia.

23. **Riduzione tempi di training**  
    Stato: **ASSENTE**  
    Evidenza: nessun onboarding guidato, help contestuale o metriche di adozione in codice.

## 4) Punti deboli principali da risolvere (priorita alta)

1. Assenza totale del dominio ordini/spedizioni/resi (core business richiesto).
2. Modello inventario troppo semplice (nessuna ubicazione, movimenti, prenotazioni, lotti).
3. Nessun connettore esterno verso e-commerce/corrieri/ERP.
4. Analytics limitata a guadagni/fatture; nessun KPI logistico operativo.
5. Automazioni non orientate alla logistica e in parte simulate.
6. Mancanza di requisiti non funzionali enterprise (HA 99.9+, observability, GDPR by design).
7. UX magazzino non pronta per uso intensivo su tablet/scanner.

## 5) Specifica implementativa obbligatoria per IA (target)

Questa sezione definisce cosa l'IA dovra' implementare in modo completo.

### 5.1 Architettura moduli (obbligatoria)

Implementare moduli separati ma integrati:

- `oms`
- `wms`
- `tms`
- `reverse-logistics`
- `integrations`
- `analytics`

Ogni modulo deve avere:

- entita DB dedicate
- API REST versionate (`/api/v3/...`)
- service layer con validazione/normalizzazione
- audit/eventi dominio
- permessi RBAC specifici

### 5.2 Modello dati minimo richiesto

Aggiungere tabelle (o equivalenti) con chiavi tenant-aware:

- OMS: `sales_channels`, `channel_connections`, `orders`, `order_lines`, `order_addresses`, `order_events`
- WMS: `warehouses`, `warehouse_zones`, `warehouse_locations`, `inventory_items`, `inventory_lots`, `stock_movements`, `stock_reservations`, `picking_waves`, `picking_tasks`
- TMS: `carriers`, `shipments`, `shipment_packages`, `route_plans`, `tracking_events`, `delivery_exceptions`
- Reverse: `returns`, `return_lines`, `rma_policies`, `reverse_workflows`, `return_events`
- Integrazioni: `integration_accounts`, `integration_sync_jobs`, `integration_webhook_events`, `integration_errors`
- Analytics: `kpi_snapshots` o viste materializzate dedicate per OMS/WMS/TMS

Vincoli obbligatori:

- `studio_id` su tutte le entita tenant
- indici su chiavi operative (es. `order_number`, `external_order_id`, `tracking_number`, `location_code`)
- audit trail append-only per eventi critici (ordine, stock, spedizione, reso)

### 5.3 OMS - requisiti implementativi

- Import automatico ordini da Shopify/Magento (pull + webhook)
- Idempotenza su ordini esterni (`external_order_id` + `channel_id`)
- Normalizzazione:
  - stato ordine canonico
  - SKU
  - anagrafiche cliente
  - indirizzi e timezone
  - importi/valute/tasse
- Regole di validazione con classificazione errori (`blocking`, `warning`)
- Coda retry per ordini falliti con DLQ e tracciabilita

### 5.4 WMS - requisiti implementativi

- Mappa ubicazioni (`warehouse > zone > location/bin`)
- Movimentazioni inventario con causale (inbound, allocazione, picking, rettifica, reso)
- Prenotazione stock per ordine e rilascio prenotazioni
- Picking batch e wave:
  - generazione wave per finestra temporale
  - ottimizzazione sequenza per ubicazione
  - task operatore con stati (`queued`, `in_progress`, `picked`, `exception`)
- Aggiornamento stock near-real-time con eventi e lock concorrenza

### 5.5 TMS - requisiti implementativi

- Pianificazione tratte per spedizioni pending
- Ottimizzazione carichi su vincoli peso/volume/priorita
- Generazione etichette e assegnazione corriere
- Tracking live via polling API carrier + webhook inbound
- Gestione eccezioni consegna (failed attempt, address issue, lost)

### 5.6 Reverse logistics - requisiti implementativi

- Apertura RMA e classificazione motivo reso
- Workflow automatici per stato reso:
  - `requested`
  - `authorized`
  - `in_transit`
  - `received`
  - `inspected`
  - `restocked|scrapped|refunded`
- Tracciabilita completa eventi con attore, timestamp, canale
- Reintegro stock o scarto con causali e impatto contabile

### 5.7 Integrazioni - requisiti implementativi

- Connettori e-commerce:
  - Shopify
  - Magento
- Connettori carrier:
  - SDA
  - DHL
  - GLS
- Connettore ERP/accounting:
  - export/import documenti contabili e riconciliazioni
- Requisiti tecnici integrazione:
  - OAuth/API key secure storage
  - webhook signature verification
  - idempotency keys
  - retry con backoff
  - dead-letter queue
  - osservabilita per sync job

### 5.8 Analytics & reporting - requisiti implementativi

Dashboard KPI in tempo reale (non solo revenue), almeno:

- ordini acquisiti, processati, in errore
- stock accuracy, stockout rate
- produttivita picking per operatore
- lead time ordine->spedizione
- on-time delivery
- resi per motivo/tasso reso

Analisi dimensionali:

- per cliente
- per area geografica
- per operatore

Forecasting domanda:

- serie storiche per SKU/categoria/area
- modello baseline (es. media mobile stagionale) + estensione ML futura
- output: domanda prevista, safety stock suggerito, alert rischio rottura stock

### 5.9 Requisiti tecnici non funzionali (obbligatori)

- Cloud SaaS:
  - deployment containerizzato
  - scaling orizzontale servizi stateless
  - separazione ambienti (dev/staging/prod)
- Sicurezza:
  - cifratura dati sensibili at-rest e in-transit
  - RBAC esteso ai nuovi moduli
  - audit sicurezza
  - hardening webhook/API
- GDPR:
  - data retention configurabile
  - export/cancellazione dati personali
  - minimizzazione e mascheramento PII in log
  - consenso e finalita trattamento tracciate
- Alta disponibilita:
  - target uptime > 99.9%
  - health/readiness/liveness endpoint
  - alerting e monitoraggio error budget
  - backup/restore testati

### 5.10 UX/UI operativa

- Interfaccia magazzino task-oriented (non solo CRUD):
  - coda task picking/packing
  - percorso guidato per operatore
  - gestione eccezioni rapida
- Mobile/tablet/scanner:
  - layout touch-first
  - scansione barcode/QR nei flussi picking, packing, resi
- Riduzione training:
  - onboarding guidato in-app
  - hint contestuali
  - lessico operativo coerente
  - playbook errori comuni

## 6) Piano di delivery suggerito (per IA di sviluppo)

1. **Fase A - Fondazione dominio**  
   Schema DB OMS/WMS/TMS/Reverse + API base + RBAC.
2. **Fase B - Integrazioni esterne**  
   Shopify/Magento + SDA/DHL/GLS + pipeline sync resilienti.
3. **Fase C - Operativita magazzino**  
   Ubicazioni, wave picking, stock reservation, scanner flow.
4. **Fase D - Spedizioni e resi**  
   Route planning, tracking live, workflow reverse completo.
5. **Fase E - Analytics e forecasting**  
   KPI logistici real-time + previsioni domanda.
6. **Fase F - NFR enterprise**  
   HA 99.9+, GDPR compliance completa, observability/SLO.

## 7) Criteri di accettazione finali (Definition of Done)

Per dichiarare completato il perimetro richiesto:

- tutti i 23 requisiti sopra devono risultare almeno **PRESENTE**
- integrazioni Shopify/Magento/SDA/DHL/GLS/ERP operative in ambiente test
- KPI logistici visibili in dashboard e coerenti con dati operativi
- reverse logistics tracciata end-to-end con audit completo
- evidenza tecnica documentata per uptime target, sicurezza e GDPR

## 8) Nota di coerenza progetto attuale

La base esistente (multi-tenant, RBAC, feature flags, auth, audit, UI web) e' utile come fondazione, ma non copre il dominio logistico richiesto.  
La roadmap deve essere trattata come **estensione strutturale del prodotto**, non come patch incrementale del solo modulo `prodotti`.
