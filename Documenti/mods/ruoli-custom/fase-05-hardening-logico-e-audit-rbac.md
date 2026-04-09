# FASE 5 - HARDENING LOGICO E AUDIT RBAC HALO

Data: `05 Aprile 2026`
Ambito: `daemon RBAC audit + error clarity`
Stato: `completata`

## Obiettivo chiuso in questa fase

Rendere piu' leggibili e utili le operazioni audit relative a ruoli custom e assegnazioni utente tenant, distinguendo chiaramente:

- cambio ruolo di sistema;
- aggiunta o rimozione ruoli custom;
- aggiornamento complessivo delle assegnazioni.

## Gap individuato

Prima di questa fase:

- esisteva un evento generico `daemon.tenant_user.roles_updated`;
- il log non separava bene:
  - cambio del ruolo di sistema;
  - aggiunta di ruoli custom;
  - rimozione di ruoli custom;
- alcuni messaggi di errore sui payload ruolo erano troppo sintetici.

## Interventi applicati

### Catalogo eventi daemon

In [daemon-event-catalog.js](/Users/francescostrano/Desktop/HALO/backend/src/config/daemon-event-catalog.js) ho aggiunto:

- `daemon.tenant_user.system_role_changed`
- `daemon.tenant_user.custom_roles_updated`

## Audit logico applicativo

In [daemon.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/daemon.routes.js):

- ho introdotto helper per fare il diff tra assegnazioni ruolo precedenti e successive;
- il flusso `PUT /tenants/:tenantId/users/:userId/roles` ora traccia:
  - ruolo di sistema precedente e successivo;
  - ruoli custom aggiunti;
  - ruoli custom rimossi;
- oltre all'evento aggregato `daemon.tenant_user.roles_updated`, il sistema emette anche:
  - `daemon.tenant_user.system_role_changed` quando cambia il ruolo di sistema;
  - `daemon.tenant_user.custom_roles_updated` quando cambia il set dei ruoli custom.

### Audit update utente

Nel flusso `PUT /tenants/:tenantId/users/:userId`:

- l'audit `daemon.tenant_user.updated` include ora anche il ruolo precedente;
- quando il cambio utente modifica il ruolo di sistema viene emesso anche `daemon.tenant_user.system_role_changed`.

### Messaggi di errore

Nel flusso assegnazioni ruolo utente:

- il caso di ruoli non trovati specifica anche il possibile mismatch di tenant;
- il caso di selezione ruoli invalida spiega che serve esattamente un solo ruolo di sistema piu' eventuali custom.

## Effetto ottenuto

Con questa fase:

- l'audit RBAC e' piu' leggibile per supporto e troubleshooting;
- il daemon distingue meglio il tipo reale di modifica effettuata;
- i messaggi di errore lato API sono piu' espliciti per la console.

## Verifica tecnica

- test backend aggiornati sul catalogo eventi;
- sintassi route daemon verificata;
- test backend eseguiti con esito positivo.

## Nota per la fase successiva

La fase 5 chiude l'hardening logico e l'audit delle scritture RBAC.  
La fase 6 sara' dedicata a QA funzionale e test di regressione della roadmap completata.
