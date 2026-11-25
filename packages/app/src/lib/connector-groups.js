// Connector types users choose between, and the connector IDs each covers
// (packages/worker/src/charger-values.js). Shared by the map's filter panel
// and the car setting's picker. `page` is the translations' page section,
// for the labels.
const connectorGroups = (page) => [
  { value: "ccs", label: "CCS", types: ["ccs2", "ccs1"] },
  { value: "chademo", label: "CHAdeMO", types: ["chademo"] },
  {
    value: "type2",
    label: page.connectorType2,
    types: ["type2", "type2-socket", "type2-tethered"],
  },
  { value: "type1", label: page.connectorType1, types: ["type1"] },
  {
    value: "tesla",
    label: "Tesla / NACS",
    types: ["nacs", "tesla-supercharger", "tesla-destination", "tesla-model-sx"],
  },
  { value: "household", label: page.connectorHousehold, types: ["schuko", "cee-7-5", "europlug"] },
];

export { connectorGroups };
