# EX-12 - Test Isolamento Query per `studio_id`

Data esecuzione: 2026-04-01  
Ambiente test: backend locale (porte 4018, 4019, 4020)

## Obiettivo
Verificare che le query backend CRUD siano isolate per `studio_id` e non consentano leak o azioni cross-studio.

## Esiti principali

1. Isolamento utenti (`/api/users`)
- admin studio A vede solo utenti studio A
- admin studio B vede solo utenti studio B
- tentativo delete utente studio A da studio B -> `404`

2. Isolamento pazienti (`/pazienti`)
- creazione paziente in studio A -> `201`
- paziente non visibile in studio B
- delete cross-studio -> `404`
- delete nello studio owner -> `200`

3. Isolamento prodotti (`/prodotti`)
- creazione prodotto in studio A -> `201`
- prodotto non visibile in studio B
- delete cross-studio -> `404`
- delete nello studio owner -> `200`

4. Integrita referenziale cross-studio
- creazione appuntamento in studio B usando `paziente_id` di studio A -> `400` (`Il paziente selezionato non esiste.`)
- creazione fattura in studio B usando `paziente_id` di studio A -> `400` (`Il paziente selezionato non esiste.`)

5. Scoping statistiche (`/stats/guadagni`)
- confronto API vs query DB per ciascun studio: valori coerenti (`matches_db=true` per studio A e B)

## Conclusione
- Scoping `studio_id` applicato con successo su query CRUD core e endpoint stats.
- Nessuna regressione bloccante rilevata nei test di isolamento cross-studio.

## Nota cleanup
- I dati temporanei di test (studio secondario e record associati) sono stati rimossi a fine verifica.
