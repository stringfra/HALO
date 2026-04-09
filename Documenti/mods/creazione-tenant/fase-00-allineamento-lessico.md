# Creazione Tenant Daemon Fase 0

Data: `04 Aprile 2026`
Stato: `completata`

## Obiettivo

Allineare il lessico del progetto prima di introdurre il workflow di creazione nuova azienda da console `daemon`.

## Esito

Il piano `PIANO-CREAZIONE-TENANT-DAEMON-HALO.md` e' stato normalizzato per distinguere in modo esplicito:

- termine tecnico backend
- termine funzionale leggibile in UI
- termine legacy gia' presente nel modello dati

## Glossario deciso

- `tenant`
  Termine tecnico di piattaforma. Va usato in backend, servizi, endpoint, payload tecnici e documentazione architetturale.

- `azienda`
  Termine funzionale leggibile. Va usato come etichetta principale nella futura UI daemon e nella documentazione rivolta a utenti non tecnici.

- `studio`
  Termine legacy gia' presente nel codice e nel database attuale HALO. Puo' restare dove gia' esiste, senza forzare rinomina immediata.

## Termine da evitare

- `attivita`

Nel contesto di questo piano non deve essere usato come sinonimo di tenant o azienda, per evitare collisioni concettuali con:

- agenda
- appuntamenti
- attivita operative
- styling RGB attivita gia' introdotto nel piano estensioni daemon

## Regola pratica d'uso

Nel backend e nei contratti tecnici:

- preferire `tenant`
- tollerare `studio` dove il modello legacy lo impone

Nella UI daemon futura:

- preferire `azienda` come etichetta primaria

Nella documentazione tecnica futura:

- usare `tenant` quando si parla di architettura o schema dati
- usare `azienda` quando si parla di flusso operativo utente

## Effetto sul piano

La Fase 0 puo' essere considerata chiusa perche':

- il piano contiene ora una sezione esplicita di normalizzazione lessico
- la futura creazione tenant non verra' piu descritta usando `attivita`
- il linguaggio del piano e' coerente con l'architettura multi-tenant gia' esistente

## Output prodotto

- allineamento terminologico nel piano principale
- glossario minimo condiviso per le prossime fasi

## Prossimo passo

La fase successiva e':

- `Fase 1. Definizione del contratto di creazione tenant`
