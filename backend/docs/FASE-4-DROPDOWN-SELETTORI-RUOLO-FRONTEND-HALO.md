# Fase 4: Aggiornamento UI dropdown e selettori ruolo

## Obiettivo

Rimuovere dal frontend le assunzioni hardcoded che mostravano ancora `DENTISTA` come ruolo standard o che non accettavano `DIPENDENTE` nei selettori e nelle guardie UI.

## Interventi applicati

### 1. Tipi condivisi frontend allineati

Sono stati aggiornati i tipi ruolo condivisi in:

- [session.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/auth/session.ts)
- [api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/users/api.ts)
- [users-list-panel.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/users/users-list-panel.tsx)

Cosa cambia:

- `DIPENDENTE` e ora accettato nella sessione frontend;
- i payload create/update utente supportano `DIPENDENTE`;
- i form utenti non partono piu dal default legacy `DENTISTA`.

### 2. Console daemon: dropdown ruolo dinamici

In [page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/daemon/console/page.tsx) i dropdown del ruolo di sistema per:

- creazione utente tenant;
- modifica utente tenant;

non sono piu hardcoded.

Ora la UI usa:

- i ruoli di sistema reali restituiti dal tenant;
- fallback `ADMIN`, `SEGRETARIO`, `DIPENDENTE` se i dati non sono ancora caricati;
- label contestuale del verticale per il ruolo operativo base.

Esempio:

- tenant dental -> `Dentista (DIPENDENTE)`
- tenant medical -> `Medico (DIPENDENTE)`

### 3. Area utenti tenant standard

In:

- [api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/users/api.ts)
- [users-list-panel.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/users/users-list-panel.tsx)

la lista operatori/practitioner ora considera sia:

- `DENTISTA`
- `DIPENDENTE`

cosi i tenant legacy e i tenant migrati restano entrambi visibili nei selettori dell'area utenti e nei flussi pazienti.

### 4. Guardie UI e routing

Sono stati allineati i controlli frontend in:

- [app-shell.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-shell.tsx)
- [pazienti-manager.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/pazienti/pazienti-manager.tsx)
- [dashboard/page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/dashboard/page.tsx)

Cosa cambia:

- `DIPENDENTE` puo accedere ai percorsi operativi previsti;
- la dashboard lo tratta come ruolo practitioner;
- le viste cliniche filtrate non sono piu limitate al solo `DENTISTA`;
- l'header mostra il `role_alias` risolto dal bootstrap quando disponibile.

### 5. Wizard nuova azienda daemon

In [page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/daemon/tenants/new/page.tsx) il riepilogo dei ruoli di sistema previsti e stato aggiornato a:

- `ADMIN`
- `SEGRETARIO`
- `DIPENDENTE`

## Risultato della fase

Dopo questa fase:

- i principali menu a tendina ruolo non mostrano piu `DENTISTA` come default tecnico delle nuove attivita;
- `DIPENDENTE` e selezionabile e riconosciuto dalla UI;
- il frontend non rifiuta piu la sessione quando il ruolo e `DIPENDENTE`;
- il daemon puo mostrare il ruolo operativo base con il nome corretto del verticale.

## Limiti intenzionali della fase

Restano ancora possibili riferimenti legacy `DENTISTA` nel frontend per:

- compatibilita con tenant non ancora migrati;
- compatibilita di tipi e filtri legacy;
- aree non ancora ripulite in modo definitivo dal lessico storico.

La rimozione finale dipendera dalle fasi successive su bootstrap coerente e persistenza `settings_json`.

## Verifiche eseguite

- eslint locale frontend sui file modificati:
  - [session.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/auth/session.ts)
  - [api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/users/api.ts)
  - [users-list-panel.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/users/users-list-panel.tsx)
  - [app-shell.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-shell.tsx)
  - [pazienti-manager.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/pazienti/pazienti-manager.tsx)
  - [dashboard/page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/dashboard/page.tsx)
  - [page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/daemon/tenants/new/page.tsx)
  - [page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/daemon/console/page.tsx)

Esito: tutto verde.
