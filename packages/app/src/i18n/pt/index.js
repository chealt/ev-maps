// Portuguese: the sections of this language (see ../index.js). A new section adds its
// file here, in every language.

import { account } from "./account.js";
import { admin } from "./admin.js";
import { adminChargerReports } from "./admin-charger-reports.js";
import { adminDashboard } from "./admin-dashboard.js";
import { adminErrors } from "./admin-errors.js";
import { adminPerformance } from "./admin-performance.js";
import { adminReports } from "./admin-reports.js";
import { adminSuggestions } from "./admin-suggestions.js";
import { adminUnavailability } from "./admin-unavailability.js";
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
  "admin-charger-reports": adminChargerReports,
  "admin-dashboard": adminDashboard,
  "admin-errors": adminErrors,
  "admin-performance": adminPerformance,
  "admin-reports": adminReports,
  "admin-suggestions": adminSuggestions,
  "admin-unavailability": adminUnavailability,
  "admin-usage": adminUsage,
};

export { sections };
