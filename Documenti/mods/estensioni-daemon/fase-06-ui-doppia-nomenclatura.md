# Estensioni Daemon Fase 6

## Obiettivo

Rendere la console `daemon` leggibile sia per operatori tecnici sia per utenti meno tecnici, mostrando nello stesso punto UI:

- nome semplice
- codice tecnico

## Intervento applicato

Aggiornata la pagina:

- `frontend/src/app/daemon/console/page.tsx`

La resa ora segue questa regola:

- nome semplice come testo principale
- codice tecnico come riferimento secondario sempre visibile

## Aree aggiornate

### Config editor

I campi base mostrano ora doppia lettura:

- `Nome visualizzato / display_name`
- `Nome azienda / business_name`
- `Colore principale brand / brand_primary_color`
- `Colore secondario brand / brand_secondary_color`
- `Lingua predefinita / default_locale`
- `Fuso orario / default_timezone`
- `Configurazione tecnica estesa / settings_json`

### Feature manager

Ogni feature tenant mostra:

- nome semplice, ad esempio `Agenda`
- chiave tecnica, ad esempio `agenda.enabled`

Le azioni di toggle continuano a usare la chiave tecnica, quindi non cambia il comportamento del salvataggio.

### Assegnazioni ruolo utente

Le checkbox ruolo mostrano:

- nome ruolo come primaria
- `role_key` come secondaria
- indicazione `system` o `custom`

### Permission catalog e ruoli

Nel catalogo permessi e nell'editor ruolo ogni permesso mostra:

- nome semplice, ad esempio `Leggere appuntamenti`
- chiave tecnica, ad esempio `appointments.read`

Inoltre ogni ruolo espone ora una vista rapida dei permessi assegnati con doppia nomenclatura.

## Risultato

La dashboard `daemon` non mostra piu feature e permessi solo come chiavi tecniche nude nelle sezioni operative principali.

## Verifica

- `eslint` OK su `frontend/src/app/daemon/console/page.tsx`

