// Whether the signed-in user is a sponsor, for the badge on their avatar and
// the thank-you in the account menu (#436): GET /api/sponsor/me answers
// { sponsor: true | false }.
//
// A sponsor (docs/features/support.md) has an active monthly sponsorship, or
// a one-time one in the last 12 months. Ko-fi sends no cancellations, so its
// monthly sponsorship is active while its last payment is under 40 days old;
// GitHub's is active until it's cancelled.

const PATH = "/api/sponsor/me";
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHLY_GRACE_DAYS = 40;
const ONE_TIME_DAYS = 365;

const isSponsor = async (env, userId, now = Date.now()) => {
  const since = (days) => new Date(now - days * DAY_MS).toISOString();
  const row = await env.DB.prepare(
    `SELECT 1 FROM sponsorships
     WHERE user_id = ? AND status = 'active' AND (
       (monthly = 1 AND (platform = 'github-sponsors' OR created_at >= ?))
       OR (monthly = 0 AND created_at >= ?)
     )
     LIMIT 1`
  )
    .bind(userId, since(MONTHLY_GRACE_DAYS), since(ONE_TIME_DAYS))
    .first();
  return Boolean(row);
};

const routes = [
  {
    name: "sponsor status",
    limiter: "SUPPORT_LIMITER",
    signedIn: true,
    matches: (request, url) => url.pathname === PATH && request.method === "GET",
    handle: async ({ env, userId }) => Response.json({ sponsor: await isSponsor(env, userId) }),
  },
];

export { isSponsor, routes };
