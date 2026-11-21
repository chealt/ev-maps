// The sources describe access, status and connectors in their own English
// words. Clients get IDs for the values they translate (the app's
// src/i18n/*.js), so the Worker never sends copy of its own.

// Open Charge Map's usage types and OpenStreetMap's access tag.
const ACCESS = {
  Public: "public",
  "Public - Membership Required": "membership",
  "Public - Pay At Location": "pay-at-location",
  "Public - Notice Required": "notice-required",
  "Private - For Staff, Visitors or Customers": "customers",
  "Private - Restricted Access": "restricted",
  "Privately Owned - Notice Required": "private-notice",
  yes: "public",
  permissive: "public",
  customers: "customers",
  destination: "customers",
  private: "private",
  no: "private",
  permit: "permit",
  // France's IRVE.
  "Accès libre": "public",
  "Accès réservé": "restricted",
};

// Open Charge Map's statuses; OpenStreetMap has none.
const STATUS = {
  Operational: "operational",
  "Not Operational": "not-operational",
  "Temporarily Unavailable": "temporarily-unavailable",
  "Planned For Future Date": "planned",
  "Partly Operational (Mixed)": "partly-operational",
  "Currently In Use": "in-use",
  "Removed (Decommissioned)": "removed",
};

// Open Charge Map's connection types and the OpenStreetMap importer's names.
const CONNECTOR_TYPES = {
  "CCS (Type 2)": "ccs2",
  "CCS (Type 1)": "ccs1",
  "Type 2 (Socket Only)": "type2-socket",
  "Type 2 (Tethered Connector)": "type2-tethered",
  "Type 2 (tethered)": "type2-tethered",
  "Type 2": "type2",
  "Type 1 (J1772)": "type1",
  CHAdeMO: "chademo",
  "GB-T DC - GB/T 20234.3": "gbt-dc",
  "GB/T DC": "gbt-dc",
  "Tesla (Model S/X)": "tesla-model-sx",
  "NACS / Tesla Supercharger": "nacs",
  NACS: "nacs",
  "Tesla Supercharger": "tesla-supercharger",
  "Tesla Destination": "tesla-destination",
  "CEE 7/5": "cee-7-5",
  "CEE 7/4 - Schuko - Type F": "schuko",
  Schuko: "schuko",
  "Europlug 2-Pin (CEE 7/16)": "europlug",
  "CEE 3 Pin": "cee-3-pin",
  "CEE 5 Pin": "cee-5-pin",
  "CEE (blue)": "cee-blue",
  "CEE (red, 16 A)": "cee-red-16a",
  "CEE (red, 32 A)": "cee-red-32a",
  "IEC 60309 3-pin": "iec-60309-3-pin",
  "IEC 60309 5-pin": "iec-60309-5-pin",
  Unknown: "unknown",
  // EIPA's connector interfaces (OCPI names).
  "IEC-62196-T2-COMBO": "ccs2",
  "IEC-62196-T1-COMBO": "ccs1",
  "IEC-62196-T2-F-NOCABLE": "type2-socket",
  "IEC-62196-T2-F-CABLE": "type2-tethered",
  "IEC-62196-T1-M-CABLE": "type1",
  "IEC-62196-T1-F-NOCABLE": "type1",
  CHADEMO: "chademo",
  "CHINA-PART3": "gbt-dc",
  "TESLA-SPECIFIC": "tesla-supercharger",
  "DOMESTIC-E": "cee-7-5",
  "DOMESTIC-F": "schuko",
  "DOMESTIC-E-F": "schuko",
  "IEC-309-2-1PH": "cee-blue",
  "IEC-309-2-3PH": "cee-red-16a",
};

// The OpenStreetMap importer stored fee=no as this cost.
const FREE_COST = "Free";

const accessId = (value) => ACCESS[value?.trim()] ?? null;

const statusId = (value) => STATUS[value?.trim()] ?? null;

// Unknown types keep the source's name: they're names, not sentences.
const connectorType = (value) => CONNECTOR_TYPES[value?.trim()] ?? value?.trim() ?? "unknown";

const isFreeCost = (value) => value?.trim().toLowerCase() === FREE_COST.toLowerCase();

export { accessId, connectorType, isFreeCost, statusId };
