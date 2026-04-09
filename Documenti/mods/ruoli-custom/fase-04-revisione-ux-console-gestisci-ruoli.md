# FASE 4 - REVISIONE UX CONSOLE DAEMON CON BOTTONE GESTISCI HALO

Data: `05 Aprile 2026`
Ambito: `frontend daemon console / tenant user management`
Stato: `completata`

## Obiettivo chiuso in questa fase

Lasciare centrale la sezione `Utenti tenant` nella console daemon e spostare la sezione `Ruoli e permessi` fuori dalla vista principale, rendendola accessibile tramite bottone `Gestisci`.

## Problema UX precedente

Prima della fase 4:

- la pagina principale mostrava contemporaneamente:
  - gestione utenti;
  - assegnazioni ruolo utente;
  - creazione ruoli;
  - modifica ruoli;
  - modifica permessi;
- la colonna `Ruoli e permessi` occupava spazio persistente nella schermata principale;
- il caso d'uso frequente `gestire utenti tenant` competeva visivamente con il caso d'uso avanzato `amministrare ruoli e permessi`.

Questo rendeva la pagina piu' densa e meno leggibile.

## Interventi applicati

In [page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/daemon/console/page.tsx):

- ho mantenuto la sezione `Utenti tenant` come focus principale della vista;
- ho aggiunto un bottone `Gestisci` nell'header della sezione utenti;
- ho rimosso la colonna ruoli/permessi dalla vista principale;
- ho introdotto un pannello modale dedicato per:
  - creare ruoli custom;
  - visualizzare ruoli tenant;
  - aggiornare metadati ruolo;
  - aggiornare permessi ruolo;
- ho mantenuto nel pannello il contesto tenant attivo, così resta chiaro su quale azienda si sta operando.

## Effetto ottenuto

La pagina principale e' ora piu' orientata all'operativita':

- al centro resta la gestione utenti tenant;
- la governance avanzata dei ruoli e permessi e' ancora disponibile, ma non occupa spazio costante;
- il bottone `Gestisci` rende il flusso piu' esplicito:
  - prima gestisci utenti;
  - se serve, apri il pannello ruoli e permessi.

## Criteri di accettazione coperti

- la sezione `Utenti tenant` resta il blocco centrale;
- `Ruoli e permessi` non e' piu' esposto direttamente nella pagina principale;
- il bottone `Gestisci` apre l'intero perimetro ruoli e permessi;
- il pannello mantiene tutte le capability gia' presenti su ruoli tenant.

## Verifica tecnica

- lint del file frontend completato senza errori;
- nessuna modifica al contratto backend in questa fase;
- nessuna regressione funzionale introdotta sul flusso ruoli esistente.

## Nota per la fase successiva

La fase 4 chiude il redesign della vista principale della console.  
La fase 5 si concentra su hardening logico e audit piu' granulari delle operazioni su ruoli custom e assegnazioni.
