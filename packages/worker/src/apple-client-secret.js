// Sign in with Apple takes a JWT, signed with the developer's private key, as
// the OAuth client secret, and accepts one for at most six months. The Worker
// signs its own, so there's no secret to renew by hand.

import { SignJWT, importPKCS8 } from "jose";

const APPLE_AUDIENCE = "https://appleid.apple.com";
// Well inside Apple's six months; auth.js signs a new one at least daily.
const SECRET_LIFETIME = "30d";

const hasAppleCredentials = (env) =>
  Boolean(env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY);

// APPLE_PRIVATE_KEY is the .p8 key file's contents; pasted on one line, its
// line breaks may arrive as "\n".
const appleClientSecret = async (env) => {
  const key = await importPKCS8(env.APPLE_PRIVATE_KEY.replaceAll("\\n", "\n"), "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: env.APPLE_KEY_ID })
    .setIssuer(env.APPLE_TEAM_ID)
    .setSubject(env.APPLE_CLIENT_ID)
    .setAudience(APPLE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(SECRET_LIFETIME)
    .sign(key);
};

export { appleClientSecret, hasAppleCredentials };
