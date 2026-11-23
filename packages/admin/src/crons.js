// The cron schedules, as the host's wrangler.toml takes them: every job of
// a firing cron runs in order.

const EVERY_15_MINUTES = "*/15 * * * *";
const EVERY_5_MINUTES = "*/5 * * * *";

export { EVERY_15_MINUTES, EVERY_5_MINUTES };
