# ADR-001 - Decisioni Architetturali Bloccanti Fase 0

Data: `20 Aprile 2026`  
Ambito: `MRD multi-tenant, identita utente, feature gating`  
Stato: `approvato tecnicamente (in attesa sign-off Product + Tech Lead)`

## 1. Scopo

Chiudere le 4 decisioni bloccanti richieste dalla Fase 0 del MRD, in modo da sbloccare in sicurezza le fasi 1-7 senza rework strutturale.

## 2. Decisioni Vincolanti

### D-001 - Unicita email

Decisione:
- `email unica globale` (case-insensitive) nel sistema.

Regola operativa:
- Canonicalizzazione in ingresso: `trim + lowercase`.
- Vincolo DB unico su email canonicalizzata.
- Login con `email + password`, senza selezione tenant in maschera.

Motivazione:
- Coerenza con implementazione attuale (`users.email` gia con vincolo `UNIQUE`).
- Riduce ambiguita di login e complessita UX in onboarding.
- Riduce rischio di collisioni identitarie cross-tenant.

Impatto:
- Sicurezza: `alto positivo`.
- UX: `positivo` (login semplice).
- Complessita: `bassa` (nessun refactor auth immediato).

Conseguenze implementative:
- Fase 1: confermare indice unico case-insensitive.
- Fase 3: hardening validazione email canonicalizzata lato API.

### D-002 - Modello utente rispetto ai tenant

Decisione:
- `utente mono-tenant` in v1 (`1 user -> 1 tenant`).

Regola operativa:
- `users.studio_id` obbligatorio, singolo tenant attivo per identita utente.
- Nessuna membership multi-tenant in questa wave.

Motivazione:
- Coerenza con schema e middleware attuali tenant-scoped.
- Riduce superficie bug autorizzativi e leakage.
- Semplifica audit trail e responsabilita utente.

Impatto:
- Sicurezza: `alto positivo`.
- UX: `neutro/positivo` per PMI (caso prevalente).
- Complessita: `bassa`.

Conseguenze implementative:
- Fase 2: enforcement tenant su tutte le query senza eccezioni multi-tenant.
- Backlog futuro: eventuale estensione con `user_tenant_memberships` in ADR dedicato.

### D-003 - Modificabilita BusinessType post-signup

Decisione:
- `consentita solo come operazione amministrativa controllata`, non self-service in MVP.

Regola operativa:
- Modifica BusinessType permessa a:
  - ruolo `owner/admin` tenant, oppure
  - console `daemon` con privilegi platform.
- Operazione transazionale con:
  - ricalcolo feature bundle,
  - audit obbligatorio (chi/quando/perche),
  - preview impatto (feature in gain/loss) prima del commit.

Motivazione:
- Mantiene flessibilita commerciale/operativa.
- Evita drift inconsapevole dei permessi da UI utente finale.
- Previene regressioni funzionali non tracciate.

Impatto:
- Sicurezza: `positivo`.
- UX: `positivo` (cambio possibile ma governato).
- Complessita: `media` (workflow controllato).

Conseguenze implementative:
- Fase 4/5: endpoint dedicato con guardie forti e audit event.
- Fase 7: runbook rollback cambio BusinessType.

### D-004 - Policy override feature per tenant

Decisione:
- `override tenant consentito` su catalogo feature ufficiale.

Regola operativa:
- Source of truth runtime:
  - `bundle base` derivato da `BusinessType`,
  - `override tenant` applicato sopra il bundle.
- Formula effettiva:
  - `effective_features = (bundle_base U force_enable) - force_disable`.
- Guardrail:
  - non si possono creare feature fuori catalogo,
  - ogni override deve essere versionato e auditato.

Motivazione:
- Bilancia standardizzazione verticale e esigenze reali di singolo tenant.
- Riduce richieste hotfix di codice per differenze contrattuali.
- Coerenza con tabelle gia presenti (`tenant_features`).

Impatto:
- Sicurezza: `neutro/positivo` (se backend-first e audit).
- UX: `positivo` (configurabilita controllata).
- Complessita: `media`.

Conseguenze implementative:
- Fase 5: backend enforcement come autorita unica.
- Fase 6: frontend solo consumer di `effective_features`, mai source of truth.

## 3. Invarianti Architetturali Derivati

1. Ogni operazione business deve essere tenant-scoped server-side.
2. Identita utente valida implica sempre tenant valido e attivo.
3. Gating funzionale effettivo e deciso dal backend.
4. Ogni cambio di policy (BusinessType/override) produce audit event tracciabile.

## 4. Rischi Residui e Mitigazioni

- Rischio: query legacy non tenant-aware.
  - Mitigazione: checklist endpoint + test cross-tenant obbligatori in Fase 2.
- Rischio: divergenza bundle/override nel tempo.
  - Mitigazione: versione configurazione e endpoint unico `effective_features`.
- Rischio: abuso cambio BusinessType.
  - Mitigazione: permesso elevato + audit + preview impatto.

## 5. Gate Fase 0

Esito gate:
- Decisioni bloccanti pendenti: `0`.
- Ambiguita critiche residue: `0`.
- Fase successiva sbloccata: `Fase 1 - Modello Dati Multi-tenant`.

## 6. Firma Decisionale

- Product Owner: `__________________` Data: `____/____/______`
- Tech Lead: `__________________` Data: `____/____/______`

