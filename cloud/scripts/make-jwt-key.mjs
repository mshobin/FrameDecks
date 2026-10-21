// Makes the ES256 key the API signs access tokens with. Prints the two secrets to set:
//   node scripts/make-jwt-key.mjs
//   npx wrangler secret put JWT_PRIVATE_KEY --env staging    (paste the JSON)
//   npx wrangler secret put JWT_KID --env staging            (paste the id)
// For `wrangler dev`, put both lines into cloud/.dev.vars (never commit it).
import { generateKeyPairSync, randomBytes } from "node:crypto";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const kid = `k-${new Date().toISOString().slice(0, 10)}-${randomBytes(3).toString("hex")}`;
console.log(`JWT_PRIVATE_KEY='${JSON.stringify(privateKey.export({ format: "jwk" }))}'`);
console.log(`JWT_KID=${kid}`);
