import { message } from "./messages.js";

// What a charger is called: its name, else its operator.
const chargerName = (charger) => charger.name || charger.operator || message("unnamedCharger");

export { chargerName };
