import { describe, expect, test } from "bun:test";
import { fill, formatMessage, translations } from "./index.js";

// Every language's pages are built the same way, from its copy: one page per
// language shows the wiring end to end (languages.spec.js: Polish, Spanish
// and Hungarian); these check the rest's copy for the map and country pages,
// as Astro and the map's scripts render it.
const countryName = (country, language) =>
  new Intl.DisplayNames([language], { type: "region" }).of(country.toUpperCase());

describe("the map and country pages' copy", () => {
  test.each([
    [
      "de",
      "EV Maps - Ladestationen für Elektrofahrzeuge",
      "EV Maps - Ladestationen für Elektroautos in Ungarn",
      "Mein Standort",
      "Filter",
      "2 Ladestationen gefunden",
    ],
    [
      "fr",
      "EV Maps - Bornes de recharge pour véhicules électriques",
      "EV Maps - Bornes de recharge en Hongrie",
      "Me localiser",
      "Filtres",
      "2 bornes de recharge trouvées",
    ],
    [
      "sk",
      "EV Maps - nabíjacie stanice pre elektromobily",
      "EV Maps - nabíjačky pre elektromobily – Maďarsko",
      "Moja poloha",
      "Filtre",
      "Našli sa 2 nabíjačky",
    ],
    [
      "cs",
      "EV Maps - nabíjecí stanice pro elektromobily",
      "EV Maps - nabíječky pro elektromobily – Maďarsko",
      "Moje poloha",
      "Filtry",
      "Našly se 2 nabíječky",
    ],
    [
      "nb",
      "EV Maps - Ladestasjoner for elbiler",
      "EV Maps - Ladestasjoner i Ungarn",
      "Finn meg",
      "Filtre",
      "2 ladestasjoner funnet",
    ],
    [
      "sv",
      "EV Maps - Laddstationer för elbilar",
      "EV Maps - Laddstationer i Ungern",
      "Hitta mig",
      "Filter",
      "2 laddstationer hittades",
    ],
    [
      "pt",
      "EV Maps - Postos de carregamento para veículos elétricos",
      "EV Maps - Carregadores para veículos elétricos – Hungria",
      "A minha localização",
      "Filtros",
      "2 carregadores encontrados",
    ],
    [
      "it",
      "EV Maps - Stazioni di ricarica per veicoli elettrici",
      "EV Maps - Colonnine di ricarica – Ungheria",
      "La mia posizione",
      "Filtri",
      "2 colonnine trovate",
    ],
    [
      "da",
      "EV Maps - Ladestandere til elbiler",
      "EV Maps - Ladestandere i Ungarn",
      "Find mig",
      "Filtre",
      "2 ladestandere fundet",
    ],
  ])("in %p", (language, title, countryTitle, locate, filters, chargersFound) => {
    const { page, messages } = translations(language);
    expect(page.title).toBe(title);
    expect(fill(page.countryTitle, { country: countryName("hu", language) })).toBe(countryTitle);
    expect(page.locate).toBe(locate);
    expect(page.filters).toBe(filters);
    expect(formatMessage(language, messages.chargersFound, { count: 2 })).toBe(chargersFound);
  });
});
