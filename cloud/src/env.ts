// The Worker's bindings and secrets (docs/architecture/cloud-api.md §7). Secrets are optional: a feature whose
// secrets are missing reports itself as not set up instead of failing.
export interface Env {
  DB: D1Database;
  RELAY: DurableObjectNamespace<import("./relay").RuntimeRelay>;   // one RuntimeRelay per runtime
  ENVIRONMENT?: string;                 // production | staging | dev | test
  CORS_ORIGINS?: string;                // origins the PWA is served from, comma-separated ("http://localhost:*": any port)
  PUBLIC_ORIGIN?: string;               // the API's public address, when it differs from the request's
  JWT_PRIVATE_KEY?: string;             // ES256 private key, JWK JSON
  JWT_KID?: string;
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;           // the .p8 key (PKCS#8 PEM)
}

/** dev and test show email codes in the answer, so sign-in works without a mailer. */
export const isDevLike = (env: Env): boolean => env.ENVIRONMENT === "dev" || env.ENVIRONMENT === "test";
