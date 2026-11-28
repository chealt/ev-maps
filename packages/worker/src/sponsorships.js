// Webhooks recording sponsorships (#434), for the admin area's sponsor stats
// and the sponsor badge (#420). See docs/features/support.md for setting them
// up.
//
// - POST /api/webhooks/github-sponsors: GitHub's `sponsorship` events, signed
//   with GITHUB_SPONSORS_WEBHOOK_SECRET (X-Hub-Signature-256). One row per
//   sponsorship; a tier change updates it, a cancellation marks it cancelled.
//   Linked to the account that signs in with the sponsor's GitHub account.
// - POST /api/webhooks/kofi: Ko-fi's payments, form-encoded `data` JSON with
//   KOFI_VERIFICATION_TOKEN. One row per payment; linked to the account with
//   the payer's email address, when it's verified.
//
// A repeated webhook updates its row instead of adding one. Without its
// secret, a webhook answers 404, as if it didn't exist.

const GITHUB_PATH = "/api/webhooks/github-sponsors";
const KOFI_PATH = "/api/webhooks/kofi";
const MAX_BODY_BYTES = 64 * 1024;

const encoder = new TextEncoder();

const hexToBytes = (hex) => {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) {
    return null;
  }
  return Uint8Array.from(hex.match(/../g), (byte) => Number.parseInt(byte, 16));
};

// Whether `signature` ("sha256=<hex>") is the body's HMAC with the secret;
// crypto.subtle.verify compares in constant time.
const isGithubSignature = async (secret, body, signature) => {
  const bytes = hexToBytes(signature?.startsWith("sha256=") ? signature.slice(7) : "");
  if (!bytes) {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(body));
};

// Compares two strings without leaking where they differ.
const isSameSecret = (expected, actual) => {
  if (typeof actual !== "string") {
    return false;
  }
  const a = encoder.encode(expected);
  const b = encoder.encode(actual);
  let difference = a.length ^ b.length;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ (b[index % (b.length || 1)] ?? 0);
  }
  return difference === 0;
};

const toCents = (amount) => {
  const number = Number.parseFloat(amount);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
};

const userWithGithubId = async (env, githubId) => {
  if (githubId == null) {
    return null;
  }
  const row = await env.DB.prepare(
    `SELECT "userId" AS id FROM "account" WHERE "providerId" = 'github' AND "accountId" = ?`
  )
    .bind(String(githubId))
    .first();
  return row?.id ?? null;
};

const userWithEmail = async (env, email) => {
  if (!email) {
    return null;
  }
  const row = await env.DB.prepare(
    `SELECT "id" FROM "user" WHERE lower("email") = lower(?) AND "emailVerified" = 1`
  )
    .bind(email)
    .first();
  return row?.id ?? null;
};

// Adds the sponsorship, or updates it when the platform sent it before.
const saveSponsorship = (env, row) =>
  env.DB.prepare(
    `INSERT INTO sponsorships
       (platform, platform_id, created_at, amount_cents, currency, tier, monthly, user_id, sponsor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (platform, platform_id) DO UPDATE SET
       amount_cents = excluded.amount_cents, currency = excluded.currency,
       tier = excluded.tier, monthly = excluded.monthly,
       user_id = COALESCE(excluded.user_id, user_id), sponsor = excluded.sponsor`
  )
    .bind(
      row.platform,
      row.platformId,
      row.createdAt,
      row.amountCents,
      row.currency,
      row.tier,
      row.monthly ? 1 : 0,
      row.userId,
      row.sponsor
    )
    .run();

const GITHUB_SAVED = new Set(["created", "edited", "tier_changed", "pending_tier_change"]);

const githubSponsorsResponse = async (request, env, now = Date.now()) => {
  const secret = env.GITHUB_SPONSORS_WEBHOOK_SECRET;
  if (!secret || !env.DB) {
    return new Response(null, { status: 404 });
  }
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  }
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }
  if (!(await isGithubSignature(secret, body, request.headers.get("x-hub-signature-256")))) {
    return new Response(null, { status: 401 });
  }
  if (request.headers.get("x-github-event") !== "sponsorship") {
    // e.g. the "ping" GitHub sends when the webhook is added.
    return new Response(null, { status: 204 });
  }
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  const { action, sponsorship } = payload ?? {};
  const platformId = sponsorship?.node_id;
  if (!platformId) {
    return new Response(null, { status: 400 });
  }
  if (action === "cancelled") {
    await env.DB.prepare(
      `UPDATE sponsorships SET status = 'cancelled', cancelled_at = ?
       WHERE platform = 'github-sponsors' AND platform_id = ?`
    )
      .bind(new Date(now).toISOString(), platformId)
      .run();
    return new Response(null, { status: 204 });
  }
  if (!GITHUB_SAVED.has(action)) {
    // pending_cancellation: still a sponsor until "cancelled" comes.
    return new Response(null, { status: 204 });
  }
  const { sponsor, tier } = sponsorship;
  await saveSponsorship(env, {
    platform: "github-sponsors",
    platformId,
    createdAt: sponsorship.created_at ?? new Date(now).toISOString(),
    amountCents: tier?.monthly_price_in_cents ?? null,
    currency: tier ? "USD" : null,
    tier: tier?.name ?? null,
    monthly: tier ? !tier.is_one_time : false,
    userId: await userWithGithubId(env, sponsor?.id),
    sponsor: sponsor?.login ?? null,
  });
  return new Response(null, { status: 204 });
};

const kofiResponse = async (request, env, now = Date.now()) => {
  const token = env.KOFI_VERIFICATION_TOKEN;
  if (!token || !env.DB) {
    return new Response(null, { status: 404 });
  }
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  }
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }
  let payment;
  try {
    payment = JSON.parse(new URLSearchParams(body).get("data") ?? "");
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!isSameSecret(token, payment?.verification_token)) {
    return new Response(null, { status: 401 });
  }
  const platformId = payment.kofi_transaction_id ?? payment.message_id;
  if (!platformId) {
    return new Response(null, { status: 400 });
  }
  await saveSponsorship(env, {
    platform: "ko-fi",
    platformId: String(platformId),
    createdAt: payment.timestamp ?? new Date(now).toISOString(),
    amountCents: toCents(payment.amount),
    currency: payment.currency ?? null,
    tier: payment.tier_name ?? null,
    monthly: payment.type === "Subscription" || payment.is_subscription_payment === true,
    userId: await userWithEmail(env, payment.email),
    sponsor: payment.email ?? null,
  });
  // Ko-fi wants a 200.
  return new Response(null, { status: 200 });
};

const routes = [
  {
    name: "github sponsors webhook",
    limiter: "WEBHOOK_LIMITER",
    webhook: true,
    signedIn: false,
    matches: (request, url) => url.pathname === GITHUB_PATH,
    handle: ({ request, env }) => githubSponsorsResponse(request, env),
  },
  {
    name: "ko-fi webhook",
    limiter: "WEBHOOK_LIMITER",
    webhook: true,
    signedIn: false,
    matches: (request, url) => url.pathname === KOFI_PATH,
    handle: ({ request, env }) => kofiResponse(request, env),
  },
];

export { githubSponsorsResponse, isSameSecret, kofiResponse, routes };
