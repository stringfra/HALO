# Fase 2: Repair e backfill RBAC tenant standard

## Obiettivo

Fornire un percorso operativo per riallineare i tenant gia compromessi da utenti creati o aggiornati dal flusso standard prima del fix della Fase 1.

## Problema affrontato

Anche dopo il fix del flusso standard, possono esistere tenant con utenti in stato incoerente:

- `users.ruolo` valorizzato;
- nessun ruolo di sistema in `user_roles`;
- mismatch tra ruolo base e assegnazione di sistema;
- piu ruoli di sistema assegnati allo stesso utente.

Questo stato sporco puo continuare a produrre errori su:

- creazione pazienti;
- appuntamenti;
- fatture;
- bootstrap tenant;
- navigazione frontend.

## Interventi applicati

### 1. Self-healing applicativo sul calcolo permessi

In [permissions.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/permissions.service.js) e stato introdotto un controllo di consistenza:

- se l'utente non ha il ruolo di sistema coerente con `users.ruolo`;
- il backend prova a riallinearlo automaticamente prima di leggere i permessi.

Questo riduce l'impatto operativo immediato sui tenant gia sporchi.

### 2. Script operativo di audit e repair

E stato aggiunto:

- [repair-tenant-rbac.js](/Users/francescostrano/Desktop/HALO/backend/scripts/repair-tenant-rbac.js)

Lo script supporta:

- check di un tenant singolo;
- repair di un tenant singolo;
- check globale di tutti i tenant;
- repair globale dei tenant non sani.

### 3. Script npm dedicato

In [package.json](/Users/francescostrano/Desktop/HALO/backend/package.json) e stato aggiunto:

- `npm run repair-tenant-rbac`

## Uso operativo

### Check tenant singolo

```bash
npm run repair-tenant-rbac -- --tenant-id 12 --mode check
```

### Repair tenant singolo

```bash
npm run repair-tenant-rbac -- --tenant-id 12 --mode repair
```

### Check globale

```bash
npm run repair-tenant-rbac -- --all --mode check
```

### Repair globale tenant non sani

```bash
npm run repair-tenant-rbac -- --all --mode repair
```

## Criteri di accettazione

- esiste un percorso operativo ripetibile per identificare tenant sporchi;
- esiste un percorso operativo ripetibile per riallineare i tenant sporchi;
- il sistema non dipende piu solo da interventi manuali record-per-record.
