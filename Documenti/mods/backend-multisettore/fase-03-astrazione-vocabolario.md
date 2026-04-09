# Fase 3 - Astrazione Del Vocabolario Di Dominio HALO

Data: `03 Aprile 2026`
Ambito: `backend service + response DTO`
Stato: `completato`

## Obiettivo chiuso in questa fase

Ridurre la propagazione del naming dentistico nelle API senza rinominare ancora le tabelle legacy.

## Modifiche eseguite

Service aggiunto in [domain-aliases.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/domain-aliases.service.js).

Questo layer aggiunge alias neutrali alle response backend mantenendo i campi legacy per compatibilita:

- `client_id` per record da `pazienti` e record collegati
- `owner_user_id` e `owner_display_name` al posto del solo `medico_*`
- `appointment_id`, `appointment_status`, `appointment_date`
- `invoice_id`, `invoice_status`, `payment_provider_status`, `payment_checkout_url`
- `inventory_item_id`, `stock_quantity`, `reorder_threshold`
- `role_key`, `role_alias`

## Route aggiornate

- [pazienti.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/pazienti.routes.js)
- [appuntamenti.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/appuntamenti.routes.js)
- [fatture.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/fatture.routes.js)
- [prodotti.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/prodotti.routes.js)
- [users.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/users.routes.js)

## Risultato pratico

Le nuove integrazioni frontend o service possono iniziare a leggere nomi core neutrali senza dipendere da:

- `pazienti`
- `medico_id`
- `medico`
- `ruolo` come unico riferimento semantico

## Compatibilita

I campi legacy restano presenti nelle response, quindi il frontend attuale non viene rotto. La neutralizzazione del linguaggio parte dal layer DTO/API e non dal rename fisico del database.
