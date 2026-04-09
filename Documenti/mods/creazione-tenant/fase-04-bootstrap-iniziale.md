# Creazione Tenant Daemon Fase 4

Data: `04 Aprile 2026`
Stato: `completata`

## Obiettivo

Definire cosa deve essere inizializzato automaticamente quando nasce un nuovo tenant creato da `daemon`.

## Principio guida

Il bootstrap iniziale del tenant deve essere sufficiente a rendere il tenant immediatamente leggibile da:

- `getTenantConfigById(...)`
- `getTenantBootstrap(...)`
- navigazione tenant
- risoluzione feature flags
- risoluzione labels
- modello ruoli/permessi

## Blocchi da bootstrapare

La nascita del tenant deve inizializzare almeno questi blocchi:

- record tenant base
- settings iniziali
- labels iniziali
- ruoli di sistema
- permessi ruolo
- admin iniziale
- feature flags risolte dal vertical

## Sorgenti di verita' da riusare

Per evitare divergenze, il bootstrap deve derivare i default da sorgenti gia' presenti:

- `multi-sector`
  Per vertical statici, labels di base, ruoli e moduli

- `vertical-templates`
  Per eventuali override database-driven di:
  - `default_settings`
  - `default_labels`
  - `default_features`
  - `default_roles`

- `tenant-config`
  Per il modo in cui il tenant viene letto a runtime

- `feature-flags`
  Per il modo in cui feature, navigation ed enabled modules vengono risolti

## Mappa del bootstrap iniziale

### 1. Tenant base

Il tenant deve nascere con:

- `codice`
- `nome`
- `display_name`
- `business_name`
- `vertical_key`
- `default_locale`
- `default_timezone`
- `settings_json`
- `settings_version`
- `is_active`

### 2. Settings iniziali

Lo `settings_json` iniziale deve essere minimo e controllato.

Contenuto consigliato:

- `product_name`
  opzionale se il default branding HALO e' sufficiente

- `labels`
  solo se servono override iniziali al vertical

- `roles`
  ruoli default previsti dal vertical/template

Scelta consigliata:

- non salvare chiavi inutili se i default sono gia' derivabili
- salvare solo il minimo necessario a rendere il tenant coerente

### 3. Labels iniziali

Le labels devono derivare da:

1. `CORE_DOMAIN_LABELS`
2. labels del vertical
3. labels del vertical template
4. eventuali override tenant espliciti

Nella prima versione, il tenant nuovo dovrebbe usare solo:

- labels vertical
- labels template

senza customizzazioni manuali in input.

### 4. Feature flags iniziali

Le feature iniziali devono derivare dal vertical template.

Scelta consigliata:

- nessun override creato in `tenant_features` se non strettamente necessario
- i default devono essere risolti dal template, non duplicati inutilmente

Questo mantiene piu pulito il tenant appena nato.

### 5. Enabled modules e navigation

Il bootstrap deve portare il tenant in uno stato in cui:

- `enabled_modules` siano risolvibili
- `feature_flags` siano risolvibili
- `navigation` sia derivabile in modo coerente

Questo richiede che:

- il vertical sia valido
- i ruoli di sistema siano presenti
- l'admin iniziale abbia permessi coerenti

### 6. Ruoli di sistema

Il tenant deve nascere con i ruoli di sistema minimi previsti da HALO.

Nel modello attuale questo significa almeno:

- `ADMIN`
- `DENTISTA`
- `SEGRETARIO`

con `display_name` coerenti e `is_system = TRUE`.

### 7. Permessi ruolo

Ogni ruolo di sistema deve nascere con i suoi permessi corretti.

La sorgente di verita' deve restare:

- `LEGACY_ROLE_PERMISSIONS`

Non va introdotto un secondo catalogo parallelo per il bootstrap del nuovo tenant.

### 8. Admin iniziale

Il tenant non e' operativo se non nasce anche:

- un utente `ADMIN`
- il ruolo legacy `ADMIN`
- l'assegnazione al ruolo di sistema `ADMIN`

Questo punto chiude davvero il bootstrap tecnico-operativo del tenant.

## Cosa non va bootstrapato nella prima versione

Per limitare la complessita' iniziale, non e' necessario bootstrapare subito:

- custom fields tenant
- utenti extra oltre all'admin iniziale
- branding avanzato custom
- feature override personalizzati
- dati applicativi demo
- automazioni preconfigurate

Questi elementi possono essere aggiunti in fasi successive o configurati dopo la creazione.

## Strategia consigliata per i feature override

Decisione consigliata:

- non creare record in `tenant_features` per tutte le feature del vertical
- creare override solo se c'e' una differenza esplicita rispetto al template

Motivo:

- tenant piu pulito
- meno rumore nei dati
- comportamento coerente con il resolver attuale delle feature

## Strategia consigliata per labels e settings

Decisione consigliata:

- usare il template come base
- salvare in `settings_json` solo i valori tenant-specifici minimi

Motivo:

- meno duplicazione
- piu facile evolvere i default in futuro
- minore rischio di settings iniziali obsoleti

## Stato minimo di bootstrap corretto

Il bootstrap iniziale e' da considerarsi corretto solo se:

- `getTenantConfigById(...)` restituisce il tenant senza errori
- `getTenantBootstrap(...)` restituisce tenant, feature, labels, ruoli e navigation
- l'admin iniziale puo' risolvere i permessi corretti
- la navigation non e' vuota per un admin standard

## Verifica logica del bootstrap

La verifica minima consigliata dopo la creazione tenant e':

1. leggere il tenant con il service standard
2. verificare il vertical risolto
3. verificare labels finali
4. verificare feature flags finali
5. verificare ruoli/permessi
6. verificare che il bootstrap tenant sia calcolabile senza eccezioni

## Decisioni prese in questa fase

- il bootstrap iniziale deve essere minimale ma sufficiente
- feature e labels devono derivare dal vertical/template
- niente override inutili nella prima versione
- niente bootstrap di dati non essenziali
- il criterio vero di successo e' la corretta risoluzione del bootstrap tenant applicativo

## Output prodotto

- mappa del bootstrap iniziale tenant
- elenco delle sorgenti di verita' da riusare
- confine tra minimo necessario e extra rimandati
- criterio di correttezza del bootstrap

## Prossimo passo

La fase successiva e':

- `Fase 5. Progettazione creazione admin iniziale`
