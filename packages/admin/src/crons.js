// The cron schedules, as wrangler.toml's triggers take them: every job of a
// firing cron runs in order (packages/worker/src/jobs.js).

const EVERY_15_MINUTES = "*/15 * * * *";
const EVERY_5_MINUTES = "*/5 * * * *";

export { EVERY_15_MINUTES, EVERY_5_MINUTES };
