# Creazione Tenant Daemon Fase 1

Data: `04 Aprile 2026`
Stato: `completata`

## Obiettivo

Definire in modo formale il contratto di creazione tenant nel perimetro `daemon`, senza ancora implementare il flusso.

## Principio guida

"Creare un tenant" in HALO non significa solo inserire un record in `studi`.

Nel contesto di questo piano, la creazione tenant e' considerata completa solo quando il sistema produce un nuovo ambiente multi-tenant immediatamente coerente con:

- bootstrap tenant
- vertical template
- feature flags
- ruoli di sistema
- admin iniziale

## Entita' coinvolte

Il contratto di creazione coinvolge almeno queste entita':

- `studi`
  Record principale del tenant

- `vertical_templates`
  Fonte dei default di vertical

- `tenant_features`
  Eventuali override espliciti rispetto ai default del vertical

- `roles`
  Ruoli di sistema tenant

- `role_permissions`
  Permessi dei ruoli tenant

- `users`
  Primo utente amministratore del tenant

- `user_roles`
  Collegamento tra admin iniziale e ruolo/i assegnati

- audit platform
  Tracciamento della creazione

- audit tenant
  Tracciamento locale del bootstrap iniziale

## Ordine logico del workflow

Ordine consigliato del contratto:

1. validare il payload di input
2. verificare unicita' del tenant
3. verificare il `vertical_key`
4. creare il record base in `studi`
5. risolvere default del vertical template
6. inizializzare settings e labels tenant
7. inizializzare ruoli di sistema e permessi
8. creare il primo admin tenant
9. assegnare i ruoli all'admin iniziale
10. applicare eventuali override iniziali di feature
11. scrivere audit platform e tenant
12. restituire il tenant creato con stato finale coerente

## Input formale minimo

Il contratto minimo di input e':

```json
{
  "code": "studio-roma-centro",
  "tenant_name": "Studio Roma Centro",
  "display_name": "Roma Centro",
  "business_name": "Studio Dentistico Roma Centro",
  "vertical_key": "dental",
  "locale": "it-IT",
  "timezone": "Europe/Rome",
  "admin": {
    "name": "Mario Rossi",
    "email": "admin@studioromacentro.it",
    "password": "PasswordTemporaneaMoltoForte123!"
  }
}
```

## Significato dei campi

- `code`
  Identificatore stabile del tenant, usato come chiave leggibile di piattaforma

- `tenant_name`
  Nome completo principale del tenant

- `display_name`
  Nome sintetico usabile in UI

- `business_name`
  Ragione sociale o denominazione estesa

- `vertical_key`
  Vertical applicativo da cui derivare default di feature, labels e ruoli

- `locale`
  Locale predefinita del tenant

- `timezone`
  Fuso orario predefinito del tenant

- `admin`
  Dati del primo utente amministratore del tenant

## Campi opzionali rimandati

Il contratto iniziale non include obbligatoriamente:

- branding iniziale custom
- labels custom iniziali
- feature override custom in input
- logo tenant
- invio automatico email
- MFA tenant

Questi punti possono essere aggiunti solo dopo aver chiuso il contratto base.

## Output formale minimo

La risposta di successo dovrebbe restituire almeno:

```json
{
  "message": "Tenant creato da daemon.",
  "tenant": {
    "id": 42,
    "code": "studio-roma-centro",
    "tenant_name": "Studio Roma Centro",
    "display_name": "Roma Centro",
    "business_name": "Studio Dentistico Roma Centro",
    "vertical_key": "dental",
    "locale": "it-IT",
    "timezone": "Europe/Rome",
    "is_active": true
  },
  "admin_user": {
    "id": 120,
    "name": "Mario Rossi",
    "email": "admin@studioromacentro.it",
    "role": "ADMIN"
  },
  "bootstrap_summary": {
    "system_roles_created": 3,
    "feature_overrides_created": 0,
    "settings_version": 1
  }
}
```

## Stato minimo di successo

Un tenant puo' essere considerato "creato correttamente" solo se alla fine del workflow risultano veri tutti questi punti:

- esiste un record coerente in `studi`
- `vertical_key` e' valido e risolvibile
- il tenant e' leggibile da `getTenantConfigById(...)`
- il bootstrap tenant e' risolvibile
- esistono i ruoli di sistema minimi
- esiste almeno un admin iniziale
- l'admin iniziale e' associato ai ruoli corretti
- la navigazione tenant puo' essere derivata senza errore
- esiste audit della creazione

## Stato di fallimento

Il contratto considera fallita la creazione tenant se anche solo uno dei punti minimi di successo non viene rispettato.

Questo implica che:

- non sono ammessi tenant parziali
- non sono ammessi admin non collegati ai ruoli
- non sono ammessi tenant con vertical non risolvibile
- non sono ammessi tenant non bootstrappabili

## Vincoli di consistenza

I vincoli minimi del contratto sono:

- `code` univoco
- `vertical_key` obbligatorio e valido
- `admin.email` obbligatoria
- `admin.password` obbligatoria nella prima versione
- creazione tenant e bootstrap admin da eseguire come singola operazione logica

## Decisioni prese in questa fase

- il contratto e' orientato a un workflow unico, non a piu chiamate scollegate
- il tenant deve uscire gia' pronto per bootstrap e login
- il vertical e' parte costitutiva della creazione, non un attributo secondario
- l'admin iniziale e' parte del contratto, non un passo manuale separato

## Output prodotto

- contratto minimo di input
- contratto minimo di output
- definizione dello stato minimo di successo
- definizione dello stato di fallimento

## Prossimo passo

La fase successiva e':

- `Fase 2. Progettazione validazioni e regole di dominio`
