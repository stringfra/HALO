const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildGoogleOAuthUrl,
  decryptGoogleToken,
  encryptGoogleToken,
  verifyOAuthState,
} = require("../src/services/google-calendar-auth.service");

function withGoogleEnv(fn) {
  const previous = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_OAUTH_REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI,
    GOOGLE_OAUTH_STATE_SECRET: process.env.GOOGLE_OAUTH_STATE_SECRET,
    GOOGLE_OAUTH_STATE_TTL_SEC: process.env.GOOGLE_OAUTH_STATE_TTL_SEC,
    GOOGLE_TOKEN_ENCRYPTION_KEY: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
    GOOGLE_OAUTH_SCOPES: process.env.GOOGLE_OAUTH_SCOPES,
  };

  process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
  process.env.GOOGLE_OAUTH_REDIRECT_URI =
    "http://localhost:4000/api/v3/integrations/google-calendar/oauth/callback";
  process.env.GOOGLE_OAUTH_STATE_SECRET =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  process.env.GOOGLE_OAUTH_STATE_TTL_SEC = "600";
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY =
    "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
  process.env.GOOGLE_OAUTH_SCOPES =
    "openid email profile https://www.googleapis.com/auth/calendar.events";

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      process.env.GOOGLE_CLIENT_ID = previous.GOOGLE_CLIENT_ID;
      process.env.GOOGLE_OAUTH_REDIRECT_URI = previous.GOOGLE_OAUTH_REDIRECT_URI;
      process.env.GOOGLE_OAUTH_STATE_SECRET = previous.GOOGLE_OAUTH_STATE_SECRET;
      process.env.GOOGLE_OAUTH_STATE_TTL_SEC = previous.GOOGLE_OAUTH_STATE_TTL_SEC;
      process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = previous.GOOGLE_TOKEN_ENCRYPTION_KEY;
      process.env.GOOGLE_OAUTH_SCOPES = previous.GOOGLE_OAUTH_SCOPES;
    });
}

test("buildGoogleOAuthUrl creates a signed state verifiable by verifyOAuthState", async () => {
  await withGoogleEnv(async () => {
    const oauth = buildGoogleOAuthUrl({
      studioId: 15,
      userId: 21,
      redirectTo: "http://localhost:3000/impostazioni",
    });

    assert.ok(typeof oauth.authUrl === "string" && oauth.authUrl.includes("accounts.google.com"));
    assert.ok(typeof oauth.state === "string" && oauth.state.includes("."));

    const parsed = verifyOAuthState(oauth.state);
    assert.equal(parsed.studioId, 15);
    assert.equal(parsed.userId, 21);
    assert.equal(parsed.redirectTo, "http://localhost:3000/impostazioni");
  });
});

test("verifyOAuthState rejects tampered signature", async () => {
  await withGoogleEnv(async () => {
    const oauth = buildGoogleOAuthUrl({
      studioId: 7,
      userId: 9,
    });

    const tampered = `${oauth.state}123`;
    assert.throws(
      () => verifyOAuthState(tampered),
      /Firma state OAuth non valida|State OAuth non valido/,
    );
  });
});

test("encryptGoogleToken and decryptGoogleToken are symmetric", async () => {
  await withGoogleEnv(async () => {
    const source = "ya29.a0AfH6SMB7exampleTokenValue";
    const encrypted = encryptGoogleToken(source);
    assert.ok(encrypted.startsWith("v1:"));

    const decrypted = decryptGoogleToken(encrypted);
    assert.equal(decrypted, source);
  });
});
