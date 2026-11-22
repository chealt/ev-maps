import { message } from "./messages.js";

// A bar of a chart (@ev-maps/ui's BarChart): "Nov 24: 7", in the page's
// language.
const dayCount = (day, count) => message("adminDayCount", { day, count });

export { dayCount };
