# AUTH API NOTES (HALO)

## Base URL
- Default: `http://localhost:4000/api`

## 1) POST `/api/login`

### Request
```json
{
  "email": "admin@studio.com",
  "password": "Admin123!"
}
```

### Response 200
```json
{
  "token": "<access_token>",
  "access_token": "<access_token>",
  "refresh_token": "<refresh_token>",
  "token_type": "Bearer",
  "expires_in": 900
}
```

### Errori tipici
- `400` payload/credenziali formalmente non validi
- `401` credenziali non valide
- `500` configurazione auth non valida

## 2) POST `/api/refresh`

### Request
```json
{
  "refresh_token": "<refresh_token>"
}
```

### Response 200
```json
{
  "access_token": "<new_access_token>",
  "refresh_token": "<new_refresh_token>",
  "token_type": "Bearer",
  "expires_in": 900
}
```

### Comportamento
- refresh token ruotato ad ogni refresh valido
- vecchio refresh token revocato

### Errori tipici
- `400` payload non valido
- `401` refresh token non valido/scaduto/revocato

## 3) POST `/api/logout`

### Request
```json
{
  "refresh_token": "<refresh_token>"
}
```

### Response 200
```json
{
  "message": "Logout completato."
}
```

### Comportamento
- revoca refresh token corrente
- endpoint idempotente (se gia revocato risponde comunque `200`)

## 4) Token access (JWT)

### Claim minimi attesi
- `id` (user id)
- `ruolo` (`ADMIN`/`DENTISTA`/`SEGRETARIO`)
- `studio_id` (contesto studio)
- `exp` / `iat` (standard JWT)

### Header protetti
- usare `Authorization: Bearer <access_token>`

## 5) Regole frontend collegate
- frontend salva `halo_auth_token` e `halo_refresh_token`
- su `401` tenta refresh una sola volta via `/api/refresh`
- se refresh fallisce: cleanup sessione e redirect `/login`
