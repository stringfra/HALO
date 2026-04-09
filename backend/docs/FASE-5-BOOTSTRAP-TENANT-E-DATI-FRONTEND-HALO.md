# Fase 5: Revisione bootstrap tenant e dati esposti al frontend

## Obiettivo

Fare in modo che il frontend usi davvero il bootstrap tenant come fonte primaria per:

- navigazione consentita;
- ruolo visibile dell'utente;
- catalogo ruoli disponibile;
- dati contestuali del tenant.

## Interventi applicati

### 1. Contratto bootstrap frontend riallineato

In [api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/bootstrap/api.ts) il tipo `BootstrapData` e stato aggiornato per riflettere meglio il payload backend.

E stato aggiunto:

- `role_catalog`

con:

- `role_key`
- `role_alias`
- `legacy_role_alias`

Questo riallinea il contratto frontend al bootstrap reale gia esposto dal backend.

### 2. App shell guidata dal bootstrap

In [app-shell.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-shell.tsx) la navigazione non ricostruisce piu ruoli fittizi quando `bootstrap.navigation` e disponibile.

Nuova regola:

- se il bootstrap e caricato, il frontend usa direttamente `bootstrap.navigation`;
- solo in assenza bootstrap resta il fallback locale statico;
- il redirect alla prima route consentita, il matching route e la sidebar si basano quindi sul payload backend del tenant.

### 3. Ruolo visibile coerente col bootstrap

L'app shell continua a mostrare il badge ruolo usando:

- `bootstrap.current_user.role_alias`

quindi il frontend visualizza il nome contestuale del verticale senza ricostruirlo localmente.

## Risultato della fase

Dopo questa fase:

- il frontend non ricostruisce piu la navigazione tenant con un set locale di ruoli quando il bootstrap e presente;
- il contratto bootstrap esposto al frontend e piu completo e coerente;
- il backend puo guidare in modo diretto ruoli visibili e menu disponibili.

## Limiti intenzionali della fase

Questa fase non corregge ancora:

- eventuali problemi di persistenza reale di `settings_json`;
- la rilettura bootstrap dopo restart se i dati persistiti non sono corretti a monte.

Questi aspetti restano nella Fase 6.

## Verifiche eseguite

- eslint locale frontend su:
  - [api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/bootstrap/api.ts)
  - [app-shell.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-shell.tsx)

Esito: tutto verde.
