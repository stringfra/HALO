# DAEMON FASE 6 AUDIT HALO

Data: `03 Aprile 2026`
Stato: `completata`

## Obiettivo della fase

Rendere tracciabili in modo affidabile le azioni `daemon`, senza appoggiarsi solo ai log tenant.

## Intervento applicato

E stato introdotto un audit di piattaforma dedicato:

- tabella `platform_audit_logs`
- servizio [backend/src/services/platform-audit-logs.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/platform-audit-logs.service.js)

## Eventi coperti

Sono ora auditati come eventi di piattaforma:

- login daemon riuscito
- login daemon fallito su errore server
- refresh sessione daemon
- logout daemon
- lettura sessione daemon
- lettura tenant registry
- modifica configurazione tenant da daemon
- modifica feature tenant da daemon

## Strategia adottata

La tracciabilita e stata resa a doppio livello:

- `tenant_audit_logs` continua a registrare gli effetti sul tenant
- `platform_audit_logs` registra l'azione come evento di governance di piattaforma

Questo consente di difendere meglio:

- chi ha agito
- da quale contesto
- su quale tenant
- con quale tipo di operazione critica

## Impatto sugli endpoint

L'endpoint:

- `GET /api/daemon/audit`

ora restituisce una vista combinata di:

- audit di piattaforma
- audit tenant

con distinzione di `audit_scope`.

## Diagnostica aggiornata

La diagnostica daemon verifica ora anche la presenza della tabella:

- `platform_audit_logs`

## Limiti residui

In questa fase non sono ancora stati aggiunti:

- codici evento formalizzati in catalogo unico
- filtri avanzati per tipo evento, tenant o intervallo temporale
- audit di lettura su tutti gli endpoint daemon read-only

Questi aspetti possono essere rifiniti nelle fasi successive.
