import { describe, expect, test } from "bun:test";
import { testD1 } from "./test-d1.js";
import { githubSponsorsResponse, isSameSecret, kofiResponse } from "./sponsorships.js";

const NOW = Date.UTC(2026, 10, 25, 12);
const SECRET = "github-secret";
const TOKEN = "kofi-token";

const database = () => {
  const db = testD1("../migrations/0002_auth.sql", "../migrations/0013_sponsorships.sql");
  db.sqlite.exec(`
    INSERT INTO "user" VALUES ('u-ada', 'Ada', 'ada@example.com', 1, NULL, 0, 0);
    INSERT INTO "user" VALUES ('u-bob', 'Bob', 'bob@example.com', 0, NULL, 0, 0);
    INSERT INTO "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
      VALUES ('a-1', '583231', 'github', 'u-ada', 0, 0);
  `);
  return db;
};
const environment = () => ({
  DB: database(),
  GITHUB_SPONSORS_WEBHOOK_SECRET: SECRET,
  KOFI_VERIFICATION_TOKEN: TOKEN,
});
const rows = (env) =>
  env.DB.sqlite
    .query(
      `SELECT platform, platform_id, created_at, amount_cents, currency, tier, monthly, status,
         cancelled_at, user_id, sponsor FROM sponsorships ORDER BY id`
    )
    .all();

const sign = async (body, secret = SECRET) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))
  );
  return `sha256=${Buffer.from(signature).toString("hex")}`;
};

const githubEvent = async (payload, { event = "sponsorship", secret } = {}) => {
  const body = JSON.stringify(payload);
  return new Request("https://ev.chealt.com/api/webhooks/github-sponsors", {
    method: "POST",
    headers: { "x-github-event": event, "x-hub-signature-256": await sign(body, secret) },
    body,
  });
};
const sponsorship = (action, tier = {}) => ({
  action,
  sponsorship: {
    node_id: "S_1",
    created_at: "2026-11-25T10:00:00Z",
    sponsor: { login: "octocat", id: 583231 },
    tier: { name: "$5 a month", monthly_price_in_cents: 500, is_one_time: false, ...tier },
  },
});

const kofiPayment = (data) =>
  new Request("https://ev.chealt.com/api/webhooks/kofi", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: JSON.stringify(data) }).toString(),
  });
const donation = (fields = {}) => ({
  verification_token: TOKEN,
  message_id: "m-1",
  kofi_transaction_id: "t-1",
  timestamp: "2026-11-25T11:00:00Z",
  type: "Donation",
  amount: "3.50",
  currency: "EUR",
  email: "ADA@example.com",
  is_subscription_payment: false,
  tier_name: null,
  ...fields,
});

describe("githubSponsorsResponse", () => {
  test("records a sponsorship, linked to the account signing in with GitHub", async () => {
    const env = environment();
    expect(
      (await githubSponsorsResponse(await githubEvent(sponsorship("created")), env, NOW)).status
    ).toBe(204);
    expect(rows(env)).toEqual([
      {
        platform: "github-sponsors",
        platform_id: "S_1",
        created_at: "2026-11-25T10:00:00Z",
        amount_cents: 500,
        currency: "USD",
        tier: "$5 a month",
        monthly: 1,
        status: "active",
        cancelled_at: null,
        user_id: "u-ada",
        sponsor: "octocat",
      },
    ]);
  });

  test("updates the tier, ignores repeats, and marks cancellations", async () => {
    const env = environment();
    await githubSponsorsResponse(await githubEvent(sponsorship("created")), env, NOW);
    await githubSponsorsResponse(await githubEvent(sponsorship("created")), env, NOW);
    await githubSponsorsResponse(
      await githubEvent(
        sponsorship("tier_changed", {
          name: "$25 once",
          monthly_price_in_cents: 2500,
          is_one_time: true,
        })
      ),
      env,
      NOW
    );
    await githubSponsorsResponse(await githubEvent(sponsorship("pending_cancellation")), env, NOW);
    expect(rows(env)).toMatchObject([
      { tier: "$25 once", amount_cents: 2500, monthly: 0, status: "active" },
    ]);
    await githubSponsorsResponse(await githubEvent(sponsorship("cancelled")), env, NOW);
    expect(rows(env)).toMatchObject([
      { status: "cancelled", cancelled_at: new Date(NOW).toISOString() },
    ]);
  });

  test("leaves a sponsor without an account unlinked", async () => {
    const env = environment();
    const payload = sponsorship("created");
    payload.sponsorship.sponsor = { login: "someone", id: 1 };
    await githubSponsorsResponse(await githubEvent(payload), env, NOW);
    expect(rows(env)).toMatchObject([{ user_id: null, sponsor: "someone" }]);
  });

  test("refuses a wrong signature, and answers pings", async () => {
    const env = environment();
    const forged = await githubEvent(sponsorship("created"), { secret: "wrong" });
    expect((await githubSponsorsResponse(forged, env, NOW)).status).toBe(401);
    const unsigned = new Request("https://ev.chealt.com/api/webhooks/github-sponsors", {
      method: "POST",
      headers: { "x-github-event": "sponsorship" },
      body: "{}",
    });
    expect((await githubSponsorsResponse(unsigned, env, NOW)).status).toBe(401);
    const ping = await githubEvent({ zen: "Keep it simple." }, { event: "ping" });
    expect((await githubSponsorsResponse(ping, env, NOW)).status).toBe(204);
    expect(rows(env)).toEqual([]);
  });

  test("doesn't exist without its secret", async () => {
    const env = { DB: database() };
    expect(
      (await githubSponsorsResponse(await githubEvent(sponsorship("created")), env, NOW)).status
    ).toBe(404);
  });
});

describe("kofiResponse", () => {
  test("records a donation, linked to the account with the verified email", async () => {
    const env = environment();
    expect((await kofiResponse(kofiPayment(donation()), env, NOW)).status).toBe(200);
    expect(rows(env)).toEqual([
      {
        platform: "ko-fi",
        platform_id: "t-1",
        created_at: "2026-11-25T11:00:00Z",
        amount_cents: 350,
        currency: "EUR",
        tier: null,
        monthly: 0,
        status: "active",
        cancelled_at: null,
        user_id: "u-ada",
        sponsor: "ADA@example.com",
      },
    ]);
  });

  test("records each monthly payment once, and doesn't link unverified emails", async () => {
    const env = environment();
    const payment = donation({
      type: "Subscription",
      is_subscription_payment: true,
      tier_name: "Supporter",
      email: "bob@example.com",
    });
    await kofiResponse(kofiPayment(payment), env, NOW);
    await kofiResponse(kofiPayment(payment), env, NOW);
    await kofiResponse(kofiPayment({ ...payment, kofi_transaction_id: "t-2" }), env, NOW);
    expect(rows(env)).toMatchObject([
      { platform_id: "t-1", monthly: 1, tier: "Supporter", user_id: null },
      { platform_id: "t-2", monthly: 1, tier: "Supporter", user_id: null },
    ]);
  });

  test("refuses a wrong token and bad bodies", async () => {
    const env = environment();
    expect(
      (await kofiResponse(kofiPayment(donation({ verification_token: "nope" })), env, NOW)).status
    ).toBe(401);
    const bad = new Request("https://ev.chealt.com/api/webhooks/kofi", {
      method: "POST",
      body: "data={",
    });
    expect((await kofiResponse(bad, env, NOW)).status).toBe(400);
    expect(
      (await kofiResponse(new Request("https://ev.chealt.com/api/webhooks/kofi"), env, NOW)).status
    ).toBe(405);
    expect(rows(env)).toEqual([]);
  });
});

describe("isSameSecret", () => {
  test("matches only the same string", () => {
    expect(isSameSecret("abc", "abc")).toBe(true);
    expect(isSameSecret("abc", "abd")).toBe(false);
    expect(isSameSecret("abc", "ab")).toBe(false);
    expect(isSameSecret("abc", "")).toBe(false);
    expect(isSameSecret("abc", undefined)).toBe(false);
  });
});
