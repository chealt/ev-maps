// Sign-in and passkeys (src/auth.js): a magic link signs the user in and
// gives a session cookie; adding a passkey then works with any valid
// session, not just one from the last 24 hours (better-auth's freshAge,
// which locked out sessions that were older — issue #267).

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Database } from "bun:sqlite";
import { createAuth } from "./auth.js";

const BASE_URL = "http://localhost:8787";

// The sign-in link the email would send: without an email service it's
// logged, which the tests capture instead.
const signInLinkOf = async (auth, email) => {
  let link = null;
  const original = console.log;
  console.log = (...args) => {
    const text = args.join(" ");
    if (text.startsWith("Sign-in link for")) {
      link = text.split(": ").at(-1);
    }
  };
  try {
    await auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-in/magic-link`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: JSON.stringify({ email }),
      })
    );
  } finally {
    console.log = original;
  }
  return link;
};

// The session cookie from verifying the link, as a cookie header.
const sessionCookieOf = async (auth, link) => {
  const response = await auth.handler(new Request(link));
  expect(response.status).toBe(302);
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
};

const passkeyOptions = (auth, cookie) =>
  auth.handler(
    new Request(`${BASE_URL}/api/auth/passkey/generate-register-options`, {
      headers: { cookie },
    })
  );

const freshAuth = async () => {
  const sqlite = new Database(":memory:");
  for (const name of ["0002_auth.sql", "0007_passkeys.sql"]) {
    sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  }
  // better-auth takes a bun:sqlite database directly (its BunSqliteDialect).
  const { auth } = await createAuth({ DB: sqlite, BETTER_AUTH_SECRET: "a".repeat(32) }, BASE_URL);
  return { auth, sqlite };
};

describe("passkey registration", () => {
  test("works with any valid session, even one older than 24 hours", async () => {
    const { auth, sqlite } = await freshAuth();
    const cookie = await sessionCookieOf(auth, await signInLinkOf(auth, "ada@example.com"));

    expect((await passkeyOptions(auth, cookie)).status).toBe(200);

    // The same session, a day old: still valid (it expires after a week),
    // so generating passkey options must still work (#267).
    sqlite.exec(`UPDATE session SET createdAt = '${new Date(Date.now() - 86400e3).toISOString()}'`);
    expect((await passkeyOptions(auth, cookie)).status).toBe(200);
  });

  test("generates options for the signed-in user", async () => {
    const { auth } = await freshAuth();
    const cookie = await sessionCookieOf(auth, await signInLinkOf(auth, "ada@example.com"));
    const response = await passkeyOptions(auth, cookie);
    const options = await response.json();
    expect(options.user.name).toBe("ada@example.com");
    expect(options.rp.name).toBe("EV Maps");
    expect(options.challenge).toBeTruthy();
  });
});
