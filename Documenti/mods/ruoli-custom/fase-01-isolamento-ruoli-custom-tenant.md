# FASE 1 - ISOLAMENTO RUOLI CUSTOM TENANT HALO

Data: `05 Aprile 2026`
Ambito: `RBAC tenant isolation`
Stato: `completata`

## Obiettivo chiuso in questa fase

Rafforzare l'isolamento dei ruoli tenant in modo che eventuali contaminazioni cross-tenant:

- non siano assegnabili dalle API daemon;
- siano diagnosticabili in modo esplicito;
- siano riparabili dai tool di supporto RBAC.

## Verifica del comportamento applicativo

Le route daemon principali erano gia' tenant-scoped:

- list ruoli tenant;
- list utenti tenant;
- create ruolo tenant;
- update ruolo tenant;
- update assegnazioni utente-ruolo.

In particolare, l'assegnazione ruoli a un utente usa gia' la risoluzione dei `role_id` filtrata per `tenantId`, quindi un ruolo di un tenant diverso non puo' essere assegnato via flusso standard daemon.

## Gap individuato

Il gap non era nella normale operativita' daemon, ma nella diagnostica:

- se nel database esistesse una contaminazione manuale o legacy in `user_roles`;
- le query applicative la nasconderebbero perche' i join tenant-aware filtrano `r.studio_id = u.studio_id`;
- il problema resterebbe invisibile invece che emergere come anomalia di isolamento.

## Interventi applicati

### Backend

In [daemon-admin-tools.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/daemon-admin-tools.service.js) ho esteso la consistenza RBAC tenant con:

- rilevazione esplicita di assegnazioni `user_roles` cross-tenant;
- arricchimento di ogni utente inconsistente con:
  - `cross_tenant_role_assignments_count`
  - issue `cross_tenant_role_assignment`
- nuovo indicatore di summary:
  - `users_cross_tenant_role_assignment_total`

Ho inoltre esteso il repair RBAC tenant per:

- rimuovere assegnazioni `user_roles` in cui il tenant dell'utente e il tenant del ruolo non coincidono;
- riportare il conteggio nel `repair_summary` come:
  - `removed_cross_tenant_role_assignments_total`

### Database / audit operativo

Ho aggiunto lo script SQL:

- [rbac_tenant_isolation_audit.sql](/Users/francescostrano/Desktop/HALO/database/rbac_tenant_isolation_audit.sql)

Lo script permette di vedere:

- dettaglio delle assegnazioni cross-tenant;
- conteggio per utente/tenant.

## Effetto ottenuto

Con questa fase:

- il modello tenant-aware non e' solo implicito nelle query;
- eventuali contaminazioni cross-tenant diventano osservabili;
- gli strumenti daemon di repair possono rimuovere anche questo tipo di anomalia.

## Criteri di accettazione coperti

- i ruoli custom restano tenant-scoped nelle API daemon;
- una contaminazione cross-tenant su `user_roles` e' ora diagnosticabile;
- il repair RBAC puo' rimuoverla automaticamente;
- esiste uno script SQL dedicato per audit operativo del database.

## Nota per la fase successiva

La fase 1 non modifica ancora l'esperienza utente di creazione/visibilita' dei ruoli custom.  
La fase successiva si concentra su create/list/refresh e coerenza di visibilita' nella console daemon.
