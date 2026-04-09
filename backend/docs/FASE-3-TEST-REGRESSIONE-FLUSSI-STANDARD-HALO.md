# Fase 3: Test di regressione sui flussi standard

## Obiettivo

Chiudere il gap di copertura che aveva permesso la regressione tra:

- flusso utenti standard tenant;
- assegnazioni `user_roles`;
- risoluzione permessi runtime;
- uso del bootstrap lato frontend.

## Problema affrontato

La suite precedente copriva:

- hardening daemon;
- cataloghi statici;
- merge `settings_json`;
- smoke test console daemon.

Non copriva invece il percorso che aveva rotto il gestionale:

- utente creato da piattaforma standard;
- permessi letti dal modello RBAC reale;
- bootstrap e navigazione dipendenti dai permessi.

## Interventi applicati

### 1. Test backend sulla riparazione permessi

In [permissions.service.test.js](/Users/francescostrano/Desktop/HALO/backend/tests/permissions.service.test.js) sono stati aggiunti test che verificano:

- fallback legacy quando `user_roles` e assente;
- ritorno dei permessi reali da `role_permissions` dopo repair implicito;
- assenza di rewrite inutile quando l'assegnazione di sistema e gia coerente.

### 2. Test backend sul servizio RBAC utente

In [tenant-user-rbac.test.js](/Users/francescostrano/Desktop/HALO/backend/tests/tenant-user-rbac.test.js) resta coperto il contratto del servizio che:

- risolve il ruolo di sistema tenant;
- sostituisce le assegnazioni di sistema incoerenti;
- riconosce quando l'assegnazione corretta e gia presente.

### 3. Smoke test frontend sul contratto standard

In [daemon-ui-smoke.test.js](/Users/francescostrano/Desktop/HALO/frontend/tests/daemon-ui-smoke.test.js) sono stati aggiunti controlli statici che bloccano regressioni su:

- endpoint utenti standard `/api/v2/users`;
- payload `display_name` e `role_key`;
- preferenza della `AppShell` per `bootstrap.navigation` rispetto ai menu locali statici.

## Verifica fase

Comandi eseguiti:

- `backend npm test`
- `frontend npm test`

## Criteri di accettazione

- la suite fallisce se il backend torna a non riallineare o non leggere correttamente il RBAC del tenant;
- la suite fallisce se il frontend smette di usare i contratti standard attesi per utenti e bootstrap;
- il percorso che aveva generato la regressione non e piu privo di copertura automatica.
