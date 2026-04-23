# MRD Tecnico - Multi-tenant, Identità Utente e Feature Gating per Tipologia Attività

## 1. Contesto
L'attuale gestionale è orientato a un singolo contesto aziendale. Per abilitarne l'utilizzo da parte di più aziende in modo sicuro e scalabile, è necessario introdurre:
- isolamento rigoroso dei dati tra aziende;
- un sistema di autenticazione con profilo utente identificabile;
- attivazione differenziata delle funzionalità in base alla tipologia attività scelta in fase di registrazione.

## 2. Obiettivi di Business
1. Consentire l'adozione del gestionale da parte di più aziende senza rischio di commistione dati.
2. Rendere l'accesso utente tracciabile e personalizzato (nome, cognome, metadati identitari base).
3. Adattare il prodotto a verticali differenti tramite feature set modulare basato su tipologia attività.

## 3. Obiettivi di Prodotto
1. Introdurre un modello logico tenant-aware (azienda come perimetro principale).
2. Introdurre identità utente persistente e associata in modo univoco a una azienda.
3. Definire un sistema di feature gating governato da "tipologia attività" selezionata al sign up.

## 4. Ambito
### In scope
- Definizione del dominio multi-tenant (azienda, utenti, ruoli, confini dati).
- Definizione del flusso login/signup con campi identitari minimi.
- Definizione mappa tipologia attività -> feature abilitate/disabilitate.
- Definizione regole di autorizzazione ad accesso dati e funzionalità.

### Out of scope
- Migrazione completa di dati legacy (da pianificare in fase dedicata).
- Refactoring UI completo non necessario agli obiettivi.
- Billing/piani commerciali (separato dal feature gating tecnico).

## 5. Stakeholder
- Product Owner
- CTO / Tech Lead
- Team Backend
- Team Frontend
- QA
- Customer Success / Onboarding

## 6. Requisiti Funzionali
### RF-1 Isolamento dati per azienda
- Ogni record di dominio deve appartenere a una e una sola azienda (`tenant_id` logico).
- Un utente autenticato può accedere solo ai dati del tenant di appartenenza.
- Le query applicative devono essere sempre contestualizzate al tenant corrente.
- Devono essere previsti controlli anti-cross-tenant sia in lettura sia in scrittura.

### RF-2 Identità e login utente
- Il sistema deve supportare account con almeno: nome, cognome, email univoca nel proprio dominio di tenancy, stato account.
- Login con credenziali sicure (password hashata o provider esterno equivalente).
- Ogni sessione deve trasportare identità utente e tenant attivo.
- Devono essere tracciati eventi minimi: signup, login riuscito/fallito, logout.

### RF-3 Sign up con tipologia attività
- In registrazione deve essere obbligatoria la selezione della tipologia attività.
- La tipologia attività determina un profilo funzionale iniziale (feature bundle).
- Il sistema deve caricare e applicare automaticamente il bundle al primo accesso.

### RF-4 Feature gating
- Ogni feature deve essere associabile a una o più tipologie attività.
- In assenza di abilitazione, la feature deve essere non accessibile lato backend e non esposta lato frontend.
- Deve essere possibile aggiornare mapping tipologia-feature senza interventi strutturali sul dominio.

### RF-5 Ruoli base
- Definire almeno ruoli iniziali per tenant (es. owner/admin/operator).
- Le autorizzazioni finali devono risultare da: ruolo + feature abilitate per tipologia.

## 7. Requisiti Non Funzionali
### RNF-1 Sicurezza
- Nessun endpoint deve restituire dati di tenant diversi da quello autenticato.
- Validazione server-side obbligatoria per tenant e permessi, indipendente dalla UI.
- Audit log per accessi e operazioni sensibili.

### RNF-2 Scalabilità
- Il modello deve supportare crescita da 1 a N aziende senza duplicare codice o istanze applicative.
- Struttura compatibile con future estensioni (multi-sede, multi-ruolo avanzato, piani commerciali).

### RNF-3 Affidabilità
- In caso di mismatch tenant/sessione, l'operazione deve fallire in modo esplicito e tracciabile.

### RNF-4 Compliance operativa
- Tracciabilità minima utile a supporto GDPR (chi ha fatto cosa e quando).

## 8. Flussi Principali
### Flusso A - Signup nuova azienda + utente owner
1. Utente inserisce dati anagrafici + credenziali + tipologia attività.
2. Sistema crea tenant aziendale.
3. Sistema crea utente owner associato al tenant.
4. Sistema applica feature bundle predefinito per tipologia.
5. Sistema avvia sessione autenticata tenant-scoped.

### Flusso B - Login utente esistente
1. Utente inserisce credenziali.
2. Sistema valida identità e stato account.
3. Sistema carica tenant e profilo autorizzativo (ruolo + feature).
4. Accesso consentito solo nel perimetro dati tenant.

### Flusso C - Accesso feature non abilitata
1. Utente tenta accesso a feature non prevista dal proprio bundle.
2. Backend nega l'operazione (errore autorizzativo).
3. Frontend mostra stato coerente (feature nascosta/disabilitata).

## 9. Modello Concettuale (alto livello)
- Entità `Tenant` (azienda)
- Entità `User` (identità, credenziali, ruolo, tenant)
- Entità `BusinessType` (tipologia attività)
- Entità `Feature` (catalogo funzionalità)
- Entità di mapping `BusinessTypeFeature`
- Eventuale mapping `RolePermission` per granularità autorizzativa

Regola cardine: ogni entità di dominio operativo deve essere tenant-scoped.

## 10. KPI di Successo
- 0 incidenti di data leakage cross-tenant in produzione.
- 100% endpoint protetti da vincolo tenant.
- 100% signup con tipologia attività valorizzata.
- Riduzione ticket "feature non pertinenti" grazie al bundle verticale.

## 11. Criteri di Accettazione
1. Dati di aziende diverse risultano inaccessibili reciprocamente in ogni flusso applicativo.
2. Ogni utente autenticato mostra correttamente nome/cognome e appartenenza aziendale.
3. La tipologia attività selezionata al sign up produce un set feature coerente e verificabile.
4. Tentativi di accesso a feature non abilitate sono bloccati lato backend.
5. Esistono test di regressione minimi su: isolamento tenant, login, gating feature.

## 12. Piano di Esecuzione Tecnico (Fasi Operative)
### Fase 0 - Decisioni Architetturali Bloccanti
Obiettivo: fissare le scelte che impattano tutto il progetto.
- Confermare: email unica globale vs email unica per tenant.
- Confermare: utente mono-tenant vs multi-tenant.
- Confermare: tipologia attività modificabile post-signup (sì/no e regole).
- Confermare: policy override feature per tenant (consentito/non consentito).
Deliverable:
- ADR (Architecture Decision Record) firmato da Product + Tech Lead.
- Matrice decisionale con impatti su sicurezza, UX e complessità.
Gate di uscita:
- Nessuna decisione bloccante pendente.

### Fase 1 - Modello Dati Multi-tenant
Obiettivo: rendere tenant-scoped il dominio.
- Definire entità core: `Tenant`, `User`, `BusinessType`, `Feature`, `BusinessTypeFeature`.
- Definire vincoli di integrità (FK, unique, nullability) orientati al tenant.
- Definire standard obbligatorio: ogni entità operativa deve avere `tenant_id`.
- Definire piano migrazione schema (forward + rollback).
Deliverable:
- Data model aggiornato (ERD + schema target).
- Documento di migrazione DB per ambienti dev/stage/prod.
- Checklist entità legacy da rendere tenant-aware.
Test/Gate:
- Verifica integrità schema su ambiente di test.
- Nessuna tabella operativa senza perimetro tenant.

### Fase 2 - Enforcement Backend Isolamento Dati
Obiettivo: impedire cross-tenant a livello server.
- Definire middleware/contesto richiesta con `tenant_id` e `user_id`.
- Applicare filtro tenant a tutte le query read/write.
- Bloccare accessi con mismatch tenant/sessione.
- Definire errori standard (`401`, `403`, `404` tenant-safe).
Deliverable:
- Specifica tecnica degli endpoint tenant-scoped.
- Lista endpoint coperti + eventuali eccezioni motivate.
Test/Gate:
- Test automatici cross-tenant (read/write/delete) tutti verdi.
- Pen test funzionale interno: zero data leakage.

### Fase 3 - Identità Utente e Login
Obiettivo: introdurre autenticazione robusta con profilo utente.
- Definire campi minimi utente: nome, cognome, email, stato, ruolo, tenant.
- Definire flussi signup/login/logout e gestione sessione.
- Definire policy password e gestione errori autenticazione.
- Definire audit eventi: signup, login success/fail, logout.
Deliverable:
- Contratto API auth completo.
- Matrice stati utente (`active`, `suspended`, ecc.).
- Tracciato audit log autenticazione.
Test/Gate:
- Test E2E auth e sessione tenant context.
- Nessun login valido senza tenant associato.

### Fase 4 - Business Type al Sign-up
Obiettivo: rendere obbligatoria la tipologia attività e usarla come driver funzionale.
- Rendere obbligatoria la selezione `BusinessType` in onboarding.
- Definire catalogo tipologie (versionato).
- Definire regole di default all'atto di creazione tenant/owner.
Deliverable:
- Catalogo ufficiale tipologie attività v1.
- Regole onboarding per assegnazione bundle iniziale.
Test/Gate:
- 100% nuovi signup con `BusinessType` valorizzata.
- Impossibilità di completare signup senza tipologia.

### Fase 5 - Feature Gating (Backend First)
Obiettivo: abilitare/disabilitare funzionalità per tipologia attività.
- Definire catalogo feature con identificatori stabili.
- Definire mapping `BusinessType -> Feature` con versione.
- Applicare autorizzazione backend su feature non abilitate.
- Esporre al frontend il profilo feature effettivo utente/tenant.
Deliverable:
- Matrice tipologia-feature ufficiale.
- Endpoint o payload sessione con feature flags effettive.
Test/Gate:
- Tentativi accesso a feature non abilitate bloccati server-side.
- Coerenza 1:1 tra matrice configurata e comportamento runtime.

### Fase 6 - Integrazione Frontend e UX di Permesso
Obiettivo: riflettere i permessi reali in interfaccia senza affidarsi solo al client.
- Nascondere/disabilitare feature non presenti nel profilo.
- Gestire stati vuoti e messaggi accesso negato coerenti.
- Evitare link diretti a viste non abilitate.
Deliverable:
- Mappa schermate -> feature richiesta.
- Specifica UX per stati non autorizzati.
Test/Gate:
- Smoke test UI per ogni tipologia attività.
- Nessuna schermata critica accessibile fuori policy.

### Fase 7 - QA Finale, Osservabilità e Go-live
Obiettivo: chiudere i rischi principali prima della messa in produzione.
- Eseguire regressione completa su isolamento, auth e gating.
- Attivare dashboard e alert su eventi auth/autorizzazione anomali.
- Preparare runbook incident response per sospetto data leakage.
- Definire rollout graduale (pilot tenant -> estensione progressiva).
Deliverable:
- Test report finale firmato QA.
- Dashboard monitoraggio + soglie alert.
- Piano di rilascio e rollback operativo.
Test/Gate:
- Zero bug bloccanti su sicurezza e segregazione dati.
- Go-live approvato da Product, Tech Lead e QA.

## 13. Rischi e Mitigazioni
- Rischio: query legacy non tenant-scoped.
  - Mitigazione: checklist endpoint + test automatici obbligatori.
- Rischio: incoerenza tra gating backend/frontend.
  - Mitigazione: backend come source of truth + contratto API esplicito.
- Rischio: matrice ruolo/feature complessa nel tempo.
  - Mitigazione: separare feature bundle (business type) da permessi ruolo.

## 14. Dipendenze
- Definizione tassonomia "tipologia attività" a livello prodotto.
- Allineamento policy sicurezza/autenticazione.
- Disponibilità ambiente test con dataset multi-tenant.

## 15. Decisioni Aperte
1. Email unica globale o unica per tenant?
2. Un utente può appartenere a più tenant?
3. Gestione override manuali alle feature di default per singolo tenant?
4. Tipologie attività modificabili post-signup o bloccate?

---
Documento MRD v1.1 - data: 20 aprile 2026
