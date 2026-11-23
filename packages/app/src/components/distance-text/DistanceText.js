import { formatDistance } from "../../lib/distance.js";
import { onDistanceUnitChange } from "../../lib/distance-unit.js";

// Every <DistanceText>'s distance in the user's unit, now and when it
// changes.
const showDistances = () => {
  for (const element of document.querySelectorAll(".distance-text[data-meters]")) {
    element.textContent = formatDistance(Number(element.dataset.meters));
  }
};

showDistances();
onDistanceUnitChange(showDistances);
