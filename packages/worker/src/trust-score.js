// How far to trust a user's report of a charger's availability or price, or
// their suggestion of a new charger: 0-100, from the proof they shared and
// who they are. The admin screens show the score with each factor's points.
//
// - location (up to 30): how near the device was to the charger, from its
//   GPS, not where the user says they were; halved when the device was
//   unsure of its position.
// - photos (up to 30): one of the charger, and one of a receipt, an invoice
//   or a charging app.
// - history (-30 to +20): their earlier reports and suggestions, approved or
//   rejected.
// - loyalty (up to 20): how long they've had an account, how often they
//   signed in and whether they keep favorites: loyal users count for more.

const NEAR_M = 150;
const CLOSE_M = 1000;
const UNSURE_ACCURACY_M = 100;
const DAYS_PER_LOYALTY_POINT = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// The great-circle distance between two points, in meters.
const distanceMeters = (from, to) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
};

const locationPoints = (distanceM, accuracyM) => {
  if (!Number.isFinite(distanceM)) {
    return 0;
  }
  const points = distanceM <= NEAR_M ? 30 : distanceM <= CLOSE_M ? 15 : 0;
  return Number.isFinite(accuracyM) && accuracyM > UNSURE_ACCURACY_M
    ? Math.floor(points / 2)
    : points;
};

// `proof`: { distanceM, accuracyM, chargerPhotos, receiptPhotos };
// `history`: { approved, rejected }; `usage`: { accountCreatedAt, sessions,
// favorites }. Returns { score, factors: [{ id, points }] }.
const trustScore = (proof, history, usage, now = Date.now()) => {
  const accountDays = usage.accountCreatedAt
    ? Math.max(0, (now - usage.accountCreatedAt) / DAY_MS)
    : 0;
  const factors = [
    { id: "location", points: locationPoints(proof.distanceM, proof.accuracyM) },
    { id: "chargerPhoto", points: proof.chargerPhotos > 0 ? 15 : 0 },
    { id: "receiptPhoto", points: proof.receiptPhotos > 0 ? 15 : 0 },
    { id: "approvedBefore", points: Math.min(20, 5 * history.approved) },
    { id: "rejectedBefore", points: 0 - Math.min(30, 10 * history.rejected) },
    {
      id: "accountAge",
      points: Math.min(10, Math.floor(accountDays / DAYS_PER_LOYALTY_POINT)),
    },
    { id: "signIns", points: usage.sessions >= 3 ? 5 : 0 },
    { id: "favorites", points: usage.favorites > 0 ? 5 : 0 },
  ];
  const score = clamp(
    factors.reduce((sum, { points }) => sum + points, 0),
    0,
    100
  );
  return { score, factors };
};

// What the score needs from the database: the user's reviewed reports and
// suggestions, their account's age, sign-ins and favorites.
const trustInputs = async (db, userId) => {
  const [reports, suggestions, user, sessions, favorites] = await Promise.all([
    db
      .prepare(
        `SELECT SUM(status = 'approved') AS approved, SUM(status = 'rejected') AS rejected
         FROM charger_reports WHERE user_id = ?`
      )
      .bind(userId)
      .first(),
    db
      .prepare(
        `SELECT SUM(status = 'approved') AS approved, SUM(status = 'rejected') AS rejected
         FROM charger_suggestions WHERE user_id = ?`
      )
      .bind(userId)
      .first(),
    db.prepare('SELECT "createdAt" AS created_at FROM "user" WHERE "id" = ?').bind(userId).first(),
    db.prepare('SELECT COUNT(*) AS count FROM "session" WHERE "userId" = ?').bind(userId).first(),
    db.prepare("SELECT COUNT(*) AS count FROM favorites WHERE user_id = ?").bind(userId).first(),
  ]);
  // Better Auth keeps dates as ISO strings; epoch milliseconds work too.
  const createdAt =
    typeof user?.created_at === "number" ? user.created_at : Date.parse(user?.created_at ?? "");
  return {
    history: {
      approved: (reports?.approved ?? 0) + (suggestions?.approved ?? 0),
      rejected: (reports?.rejected ?? 0) + (suggestions?.rejected ?? 0),
    },
    usage: {
      accountCreatedAt: Number.isFinite(createdAt) ? createdAt : null,
      sessions: sessions?.count ?? 0,
      favorites: favorites?.count ?? 0,
    },
  };
};

export { distanceMeters, trustInputs, trustScore };
