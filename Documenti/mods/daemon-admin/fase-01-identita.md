# DAEMON FASE 1 IDENTITA HALO

Data: `03 Aprile 2026`
Stato: `completata`

## Decisione architetturale

In HALO `daemon` non deve vivere come semplice ruolo nella tabella `users`.

Motivo tecnico:

- il flusso auth corrente e completamente tenant-driven
- il JWT utente richiede `studio_id`
- i permessi standard dipendono dal tenant e dai ruoli tenant
- il bootstrap e le route operative presuppongono un contesto studio

Per questo `daemon` viene definito come:

- identita di piattaforma separata
- non associata a un tenant specifico
- non dipendente da `roles`, `user_roles` o `role_permissions`
- autenticata con token JWT che portano `identity_type=daemon`

## Modello dati scelto

Tabelle dedicate:

- `platform_accounts`
- `platform_refresh_tokens`

Scelte applicate:

- nessun seed automatico dell'account `daemon`
- bootstrap credenziali esplicito in fase successiva
- refresh token separati da quelli tenant per evitare collisioni logiche e revoche miste

## Strategia di autenticazione

Sono stati definiti due contesti auth distinti:

- `tenant_user`
- `daemon`

Il payload JWT tenant resta compatibile con il codice esistente e aggiunge solo:

- `identity_type=tenant_user`

Il payload JWT daemon previsto per le fasi successive contiene:

- `identity_type=daemon`
- `account_key`
- `email`
- eventuali permessi di piattaforma

## Strategia di autorizzazione

Perimetro deciso:

- le route tenant esistenti continuano ad accettare solo `tenant_user`
- `daemon` non entra nel middleware tenant standard come scorciatoia
- l'autorizzazione daemon verra applicata con middleware dedicato nelle fasi successive

## Impatto sul progetto

Questa fase prepara il terreno senza esporre ancora accessi nuovi:

- schema DB predisposto per identita di piattaforma
- normalizzazione centralizzata del contesto auth
- compatibilita mantenuta per login e token tenant correnti
