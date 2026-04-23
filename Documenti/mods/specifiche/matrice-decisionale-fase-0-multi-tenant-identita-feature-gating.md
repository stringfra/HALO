# Matrice Decisionale Fase 0 - Multi-tenant, Identita, Feature Gating

Data: `20 Aprile 2026`  
Riferimento: `ADR-001`

## 1. Metodo

Scala punteggio:
- Sicurezza: `1` basso, `5` alto.
- UX: `1` critico/frizione alta, `5` fluida.
- Complessita implementativa: `1` bassa, `5` alta.

Criterio scelta:
- priorita a sicurezza e coerenza con architettura HALO esistente;
- minimizzazione rework nelle fasi 1-3.

## 2. Decisione A - Unicita email

| Opzione | Sicurezza | UX | Complessita | Note |
|---|---:|---:|---:|---|
| A1 - Email unica globale | 5 | 5 | 2 | Login semplice, no ambiguita tenant, coerenza schema attuale |
| A2 - Email unica per tenant | 3 | 2 | 4 | Richiede tenant selector o login a 2 step, rischio account confusion |
| A3 - Entrambe con fallback | 2 | 1 | 5 | Ambiguita alta, forte complessita e supporto difficile |

Scelta:
- `A1 - Email unica globale`.

## 3. Decisione B - Utente mono-tenant vs multi-tenant

| Opzione | Sicurezza | UX | Complessita | Note |
|---|---:|---:|---:|---|
| B1 - Mono-tenant (v1) | 5 | 4 | 2 | Isolamento lineare, audit semplice |
| B2 - Multi-tenant membership da subito | 3 | 3 | 5 | Elevata complessita su auth/session switch |
| B3 - Ibrido con account-link manuale | 2 | 2 | 4 | Alto rischio inconsistenze identitarie |

Scelta:
- `B1 - Mono-tenant`.

## 4. Decisione C - Modifica BusinessType post-signup

| Opzione | Sicurezza | UX | Complessita | Note |
|---|---:|---:|---:|---|
| C1 - Mai modificabile | 4 | 1 | 1 | Semplice ma rigido e penalizzante |
| C2 - Modificabile self-service libero | 2 | 4 | 4 | Alto rischio drift permessi e errori operativi |
| C3 - Modificabile con workflow amministrativo | 5 | 4 | 3 | Bilanciata: flessibilita + controllo |

Scelta:
- `C3 - Workflow amministrativo controllato`.

## 5. Decisione D - Override feature per tenant

| Opzione | Sicurezza | UX | Complessita | Note |
|---|---:|---:|---:|---|
| D1 - Nessun override, solo bundle BusinessType | 4 | 2 | 1 | Standard forte ma poca adattabilita cliente |
| D2 - Override libero non versionato | 1 | 4 | 2 | Rischio configurazioni opache e regressioni |
| D3 - Override consentito, versionato e auditato | 5 | 5 | 3 | Configurabilita sicura, governance chiara |

Scelta:
- `D3 - Override controllato`.

## 6. Snapshot Decisionale Finale

1. Email: `globale unica`.
2. Identita utente: `mono-tenant`.
3. BusinessType post-signup: `si, solo via workflow amministrativo`.
4. Override feature tenant: `consentito, versionato, auditato`.

## 7. Impatti Immediati su Fase 1

1. Nessun redesign auth richiesto per supportare login multi-tenant ambiguo.
2. Modello dati resta centrato su `users.studio_id` come vincolo primario.
3. Catalogo BusinessType e feature deve includere versioning fin da subito.
4. Contratto backend deve esporre `effective_features` come risultato finale.

