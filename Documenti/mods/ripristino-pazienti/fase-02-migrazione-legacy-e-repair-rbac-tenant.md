# Fase 2 - Migrazione legacy e repair RBAC tenant

## Obiettivo fase

Riallineare i tenant esistenti dal modello legacy con `DENTISTA` al modello operativo con `DIPENDENTE`, preservando coerenza tra:

- `users.ruolo`
- `roles.role_key` (system roles)
- `user_roles`
- permessi RBAC runtime

## Stato pre-intervento

### Ruoli utenti

- `ADMIN = 3`
- `DENTISTA = 1`
- `SEGRETARIO = 1`

### Ruoli di sistema tenant

- `ADMIN (system) = 3`
- `DENTISTA (system) = 3`
- `DIPENDENTE (system) = 1`
- `SEGRETARIO (system) = 3`

### Consistenza RBAC piattaforma

Check globale pre-fase:

- `tenants = 3`
- `unhealthy = 1`
- tenant non sano: `id=3` (`inconsistent=1`)

## Interventi eseguiti

### 1. Migrazione legacy ruoli

Comando eseguito:

```bash
psql "$DATABASE_URL" -f database/rbac_legacy_dentista_to_dipendente.sql
```

Effetto:

- aggiornamento `settings_json.roles`
- conversione/merge ruoli di sistema legacy
- riallineamento `users.ruolo`
- reset e rebuild assegnazioni `user_roles` di sistema
- riallineamento permessi ruolo di sistema

### 2. Repair RBAC globale

Comando eseguito:

```bash
cd backend && node scripts/repair-tenant-rbac.js --all --mode repair
```

Effetto:

- azzeramento tenant incoerenti
- conferma integrita ruoli/assegnazioni su tutti i tenant

## Stato post-intervento

### Ruoli utenti

- `ADMIN = 3`
- `DIPENDENTE = 1`
- `SEGRETARIO = 1`

### Ruoli di sistema tenant

- `ADMIN (system) = 3`
- `DIPENDENTE (system) = 3`
- `SEGRETARIO (system) = 3`
- `DENTISTA (system) = 0`

### Assegnazioni RBAC

- `user_roles_totali = 5`
- `user_system_roles_totali = 5`

Interpretazione:

- ogni utente ha assegnazione di sistema coerente

### Consistenza RBAC piattaforma

Check globale post-fase:

- `tenants = 3`
- `unhealthy = 0`
- tutti i tenant `healthy=true`

## Esito fase

Fase 2 completata con successo.

Migrazione dati e repair RBAC eseguiti sul database target con consistenza tenant riportata a stato sano.

## Residui da fase successiva

Rimane un dato applicativo non-RBAC:

- `pazienti_totali = 3`
- `senza_medico = 1`
- `medico_non_valido = 0`

Il record senza medico assegnato va gestito in fase successiva di allineamento dati clinici/assegnazioni medico.
