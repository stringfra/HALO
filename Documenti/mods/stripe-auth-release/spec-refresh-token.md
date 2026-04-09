# Mini-Spec Refresh Token (EX-06)

## 1) Stato attuale
- Login: `POST /api/login` restituisce solo `token` (JWT access token).
- Sessione frontend: salva il token in `localStorage` (`halo_auth_token`).
- API client: su `401` pulisce sessione e fa redirect a `/login`.
- Middleware backend: valida solo access token (`verifyToken`).

## 2) Obiettivo tecnico
Introdurre un ciclo completo di sessione:
- access token breve durata,
- refresh token lunga durata,
- rotazione refresh token,
- revoca esplicita su logout,
- gestione riuso token revocati.

## 3) Decisioni di design

### 3.1 Durate
- Access token: `15m` (default).
- Refresh token: `30d` (default).
- Variabili env:
  - `JWT_ACCESS_EXPIRATION` (default `15m`)
  - `JWT_REFRESH_EXPIRATION_DAYS` (default `30`)

### 3.2 Formato token
- Access token: JWT firmato con `JWT_SECRET`, claim minimi: `id`, `ruolo`.
- Refresh token: stringa random crittograficamente sicura (non JWT), lunghezza consigliata 64 byte (`base64url`).
- In DB non si salva il refresh token in chiaro: si salva solo hash SHA-256.

### 3.3 Rotazione
- Ogni `POST /api/refresh` valido:
  - revoca il refresh token corrente (`revoked_at`),
  - crea nuovo refresh token,
  - collega la catena con `replaced_by_token_id`.

### 3.4 Revoca
- `POST /api/logout` revoca il refresh token corrente.
- Token scaduti/revocati non sono riusabili.
- Se arriva un refresh token gia revocato ma appartenente a una catena ruotata, si considera tentativo di riuso e si revoca tutta la famiglia attiva dell'utente (hardening).

## 4) Modello dati

Tabella nuova: `refresh_tokens`

```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  replaced_by_token_id BIGINT NULL REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_ip VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
```

## 5) Contratti API

### 5.1 `POST /api/login`
- Input invariato: `{ email, password }`
- Output nuovo:
```json
{
  "token": "<access_token>",
  "access_token": "<access_token>",
  "refresh_token": "<refresh_token>",
  "token_type": "Bearer",
  "expires_in": 900
}
```
- `token` resta per backward compatibility frontend esistente.

### 5.2 `POST /api/refresh`
- Input:
```json
{ "refresh_token": "<refresh_token>" }
```
- Output:
```json
{
  "access_token": "<new_access_token>",
  "refresh_token": "<new_refresh_token>",
  "token_type": "Bearer",
  "expires_in": 900
}
```
- Errori:
  - `401` token refresh non valido/scaduto/revocato.
  - `400` payload non valido.

### 5.3 `POST /api/logout`
- Input:
```json
{ "refresh_token": "<refresh_token>" }
```
- Output:
```json
{ "message": "Logout completato." }
```
- Idempotente: se token gia revocato risponde comunque `200`.

## 6) Regole backend
- Il middleware `verifyToken` continua a validare solo access token.
- `authController` viene esteso con:
  - `issueAccessToken(user)`
  - `issueRefreshToken(userId, context)`
  - `rotateRefreshToken(currentToken, context)`
  - `revokeRefreshToken(token)`
- Hash refresh token: `sha256(token)`.
- Contesto request salvato su refresh token: IP + user-agent.

## 7) Regole frontend
- Sessione salva:
  - `halo_auth_token` (access token),
  - `halo_refresh_token` (refresh token).
- `api-client`:
  - su primo `401` tenta `POST /api/refresh`,
  - se refresh ok, ripete la request originale una sola volta,
  - se refresh fallisce, cleanup + redirect `/login?reason=expired`.
- Login:
  - salva entrambi i token.
- Logout:
  - chiama `/api/logout` con refresh token e poi cleanup locale.

## 8) Rollout consigliato (per EX-07/08)
1. Aggiungere tabella `refresh_tokens`.
2. Estendere backend auth (`/api/login`, `/api/refresh`, `/api/logout`).
3. Aggiornare frontend session store e api-client retry con refresh.
4. Eseguire regressione auth completa (EX-09).

## 9) Criteri di accettazione EX-06
- Design con durate definite e configurabili.
- Struttura dati refresh token definita.
- Rotazione + revoca + riuso revocato coperti.
- Contratti endpoint definiti con payload/risposte/errori.

