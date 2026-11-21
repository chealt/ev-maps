import { describe, expect, test } from "bun:test";
import { csvRows } from "../csv.js";
import { countIrveStatuses } from "../live-status.js";
import { partOf } from "../partitions.js";
import { toChargers } from "./irve.js";

const header =
  "id_station_itinerance,nom_station,adresse_station,coordonneesXY,consolidated_latitude,consolidated_longitude,nom_enseigne,nom_operateur,condition_acces,gratuit,tarification,id_pdc_itinerance,puissance_nominale,prise_type_ef,prise_type_2,prise_type_combo_ccs,prise_type_chademo,prise_type_autre,cable_t2_attache";
const rowsOf = (text) =>
  csvRows(
    new ReadableStream({
      start(controller) {
        controller.enqueue(text);
        controller.close();
      },
    })
  );

const csv = [
  header,
  // A fast station: two DC points, one with Type 2 too.
  'FRS1,Aire de Nemours,"A6, 77140 Nemours","[2.70, 48.27]",48.27,2.70,IONITY,Ionity GmbH,Accès libre,false,0.59 €/kWh,FRP1,350,false,false,true,false,false,false',
  'FRS1,Aire de Nemours,"A6, 77140 Nemours","[2.70, 48.27]",48.27,2.70,IONITY,Ionity GmbH,Accès libre,false,0.59 €/kWh,FRP2,350,false,true,true,false,false,false',
  // A free, reserved AC station, power in watts, located only by coordonneesXY.
  'FRS2,Mairie,"1 rue X, Paris","[2.35, 48.85]",,,,Ville de Paris,Accès réservé,true,,FRP3,22000,true,true,false,false,false,true',
].join("\n");

describe("toChargers", () => {
  test("groups charging points into one charger per station", async () => {
    const { chargers, pointStations } = await toChargers(rowsOf(csv));

    expect(chargers.map((charger) => charger.sourceId)).toEqual(["FRS1", "FRS2"]);
    expect(pointStations).toEqual({ FRP1: "FRS1", FRP2: "FRS1", FRP3: "FRS2" });
  });

  test("describes the station", async () => {
    const [ionity, mairie] = (await toChargers(rowsOf(csv))).chargers;

    expect(ionity).toMatchObject({
      source: "irve",
      country: "FR",
      name: "Aire de Nemours",
      address: "A6, 77140 Nemours",
      lat: 48.27,
      lng: 2.7,
      operator: "IONITY",
      usageType: "Accès libre",
      usageCost: "0.59 €/kWh",
      numberOfPoints: 2,
      maxPowerKw: 350,
    });
    expect(mairie).toMatchObject({
      lat: 48.85,
      lng: 2.35,
      operator: "Ville de Paris",
      usageType: "Accès réservé",
      usageCost: "Free",
      maxPowerKw: 22,
    });
  });

  test("gives a point's power to its DC connectors, not to AC ones next to them", async () => {
    const [ionity, mairie] = (await toChargers(rowsOf(csv))).chargers;

    expect(ionity.connectors).toEqual([
      { type: "ccs2", powerKw: 350, quantity: 2 },
      { type: "type2-socket", powerKw: null, quantity: 1 },
    ]);
    expect(mairie.connectors).toEqual([
      { type: "type2-tethered", powerKw: 22, quantity: 1 },
      { type: "schuko", powerKw: 22, quantity: 1 },
    ]);
  });

  test("takes only the stations of the given pass", async () => {
    const pass = partOf("FRS1") % 4;
    const { chargers } = await toChargers(rowsOf(csv), { pass });

    expect(chargers.some((charger) => charger.sourceId === "FRS1")).toBe(true);
    expect(chargers.every((charger) => partOf(charger.sourceId) % 4 === pass)).toBe(true);
  });
});

describe("countIrveStatuses", () => {
  test("counts free, occupied and out-of-service points per station", async () => {
    const dynamic = [
      "id_pdc_itinerance,etat_pdc,occupation_pdc,horodatage",
      "FRP1,en_service,libre,2026-11-21 14:00:00+00:00",
      "FRP2,en_service,occupe,2026-11-21 14:00:00+00:00",
      "FRP3,hors_service,inconnu,2026-11-21 14:00:00+00:00",
      "FRP9,en_service,libre,2026-11-21 14:00:00+00:00",
    ].join("\n");

    const statuses = await countIrveStatuses(rowsOf(dynamic), {
      FRP1: "FRS1",
      FRP2: "FRS1",
      FRP3: "FRS2",
      FRP4: "FRS2",
      FRP5: "FRS3",
    });

    // [available, occupied, out of service, total]; FRS3 has no status.
    expect(statuses).toEqual({ "irve:FRS1": [1, 1, 0, 2], "irve:FRS2": [0, 0, 1, 2] });
  });
});
