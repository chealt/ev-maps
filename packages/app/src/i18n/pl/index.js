// The sections of this language (see ../index.js). A new section adds its
// file here, in every language.

import { account } from "./account.js";
import { admin } from "./admin.js";
import { adminDashboard } from "./admin-dashboard.js";
import { adminErrors } from "./admin-errors.js";
import { adminPerformance } from "./admin-performance.js";
import { adminUsage } from "./admin-usage.js";
import { common } from "./common.js";
import { legal } from "./legal.js";
import { map } from "./map.js";

const sections = {
  common: common,
  map: map,
  account: account,
  legal: legal,
  admin: admin,
  "admin-dashboard": adminDashboard,
  "admin-errors": adminErrors,
  "admin-performance": adminPerformance,
  "admin-usage": adminUsage,
};

export { sections };
