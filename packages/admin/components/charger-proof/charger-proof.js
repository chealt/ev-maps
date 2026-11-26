import { formatNumber, message, valueLabel } from "@ev-maps/ui/messages.js";

// Fills in a ChargerProof (./ChargerProof.astro) from a report or a
// suggestion: its trust score and factors (packages/worker/src/
// trust-score.js), the availability and price it says, each after what the
// charger says now when known, and how far the device was from the charger.

// How far to trust it, as the score badge's tone.
const trustTone = (score) => (score >= 70 ? "success" : score >= 40 ? "warning" : "danger");

const PRICE_MESSAGES = {
  kwh: "adminPricePerKwh",
  minute: "adminPricePerMinute",
  session: "adminPricePerSession",
};

const priceText = (price) => {
  if (price.free) {
    return message("adminPriceFree");
  }
  const amount = new Intl.NumberFormat(document.documentElement.lang || "en", {
    style: "currency",
    currency: price.currency,
    maximumFractionDigits: 4,
  }).format(price.amount);
  return message(PRICE_MESSAGES[price.unit], { amount });
};

const changeText = (before, after) => (before ? message("adminChange", { before, after }) : after);

const fillChargerProof = (proof, item) => {
  const hasTrust = Number.isFinite(item.trustScore);
  const hasChange = Boolean(item.availability || item.price);
  proof.hidden = !hasTrust && !hasChange;

  const trust = proof.querySelector(".trust");
  trust.hidden = !hasTrust;
  const score = proof.querySelector(".trust-score");
  score.textContent = hasTrust ? message("adminTrustScore", { score: item.trustScore }) : "";
  score.dataset.tone = hasTrust ? trustTone(item.trustScore) : "neutral";
  proof.querySelector(".trust-factors").replaceChildren(
    ...(item.trustFactors ?? [])
      .filter(({ points }) => points !== 0)
      .map(({ id, points }) => {
        const factor = document.createElement("li");
        factor.textContent = message("adminTrustFactor", {
          factor: valueLabel("trustFactors", id),
          points: points > 0 ? `+${points}` : `${points}`,
        });
        return factor;
      })
  );

  proof.querySelector(".availability-change").hidden = !item.availability;
  proof.querySelector(".availability").textContent = item.availability
    ? changeText(
        item.currentStatus && valueLabel("status", item.currentStatus),
        valueLabel("status", item.availability)
      )
    : "";
  proof.querySelector(".price-change").hidden = !item.price;
  proof.querySelector(".price").textContent = item.price
    ? changeText(item.currentCost, priceText(item.price))
    : "";

  const device = proof.querySelector(".device-location");
  device.hidden = !hasTrust;
  device.textContent = !Number.isFinite(item.distanceM)
    ? message("adminNoDeviceLocation")
    : Number.isFinite(item.deviceLocation?.accuracy)
      ? message("adminDeviceDistanceAccuracy", {
          distance: formatNumber(item.distanceM),
          accuracy: formatNumber(Math.round(item.deviceLocation.accuracy)),
        })
      : message("adminDeviceDistance", { distance: formatNumber(item.distanceM) });
};

export { fillChargerProof };
