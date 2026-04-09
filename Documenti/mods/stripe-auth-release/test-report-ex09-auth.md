# EX-09 - Test Regressione Auth End-to-End

Data esecuzione: 2026-04-01  
Ambiente test: backend locale su porta `4015` con `JWT_ACCESS_EXPIRATION=2s`

## Scenario e risultati

1. Login con credenziali valide (`POST /api/login`)
- Esito: `200`
- Verifica: `access_token` presente, `refresh_token` presente
- Stato: PASS

2. Accesso endpoint protetto con access token fresco (`GET /api/users`)
- Esito: `200`
- Stato: PASS

3. Access token scaduto (attesa > 2s) su endpoint protetto
- Esito: `401`
- Messaggio: `Token scaduto. Effettua di nuovo il login.`
- Stato: PASS

4. Refresh sessione con refresh token valido (`POST /api/refresh`)
- Esito: `200`
- Verifica: nuovo `access_token` e nuovo `refresh_token`
- Stato: PASS

5. Accesso endpoint protetto con access token ottenuto da refresh
- Esito: `200`
- Stato: PASS

6. Riuso refresh token vecchio dopo rotazione
- Esito: `401`
- Messaggio: `Refresh token revocato.`
- Stato: PASS

7. Logout con refresh token corrente (`POST /api/logout`)
- Esito: `200`
- Messaggio: `Logout completato.`
- Stato: PASS

8. Tentativo refresh dopo logout con token revocato
- Esito: `401`
- Messaggio: `Refresh token revocato.`
- Stato: PASS

9. Tentativo refresh con token inesistente/non valido
- Esito: `401`
- Messaggio: `Refresh token non valido.`
- Stato: PASS

## Conclusione
- Flusso auth con refresh token, rotazione e revoca risulta coerente.
- Nessuna regressione bloccante rilevata nei test API end-to-end.

## Nota frontend
- Il client frontend e' stato aggiornato con retry su `401` + refresh automatico (EX-08).
- In questo passaggio non e' stato eseguito test browser automatizzato; la validazione e' API end-to-end.
