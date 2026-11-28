import { formatNumber } from "./messages.js";

const unit = (value, name) =>
  formatNumber(value, { style: "unit", unit: name, unitDisplay: "short" });

// A travel time, e.g. "45 min", "2 hr 5 min", "3 hr", in the page's
// language, to the minute (at least 1 min).
export const formatDuration = (millis) => {
  const minutes = Math.max(1, Math.round(millis / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) {
    return unit(rest, "minute");
  }
  return rest ? `${unit(hours, "hour")} ${unit(rest, "minute")}` : unit(hours, "hour");
};
