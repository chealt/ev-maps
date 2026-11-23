// Every scheduled job, by domain: when a cron fires (wrangler.toml's
// triggers, src/crons.js), its jobs run in this order (src/index.js). A job
// is { name, cron, run(env, controller) }.
//
// A new domain keeps its jobs in its own module and adds one line here.

import { jobs as errors } from "@ev-maps/admin/errors.js";
import { jobs as chargerImport } from "./import/index.js";
import { jobs as liveStatus } from "./live-status.js";
import { jobs as telemetry } from "@ev-maps/admin/telemetry.js";
import { testReportsJobs as testReports, usageJobs as usage } from "./admin-area.js";

const JOBS = [
  ...liveStatus,
  // Cleanups first: the import uses the rest of the run.
  ...errors,
  ...usage,
  ...telemetry,
  ...testReports,
  ...chargerImport,
];

export { JOBS };
