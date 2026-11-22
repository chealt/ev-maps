// Magyar: the admin area's errors page. See ../index.js for how
// the sections are put together and which pages get which.

const adminErrors = {
  page: {
    adminErrorColumn: "Hiba",
    adminSourceColumn: "Hol",
    adminCountColumn: "Hányszor",
    adminUsersColumn: "Felhasználók",
    adminLastSeenColumn: "Utoljára",
    adminFirstSeenColumn: "Először",
    adminPages: "Oldalak",
    adminPreviousPage: "Előző",
    adminNextPage: "Következő",
    adminAllErrors: "Összes hiba",
    adminTimeLabel: "Időpont",
    adminUrlLabel: "URL",
    adminContextLabel: "Feladat",
    adminBrowserLabel: "Böngésző",
    adminUserLabel: "Felhasználó",
    adminCountryLabel: "Ország",
    adminStackTrace: "Hívási verem",
    adminErrorsNotLoaded: "Nem sikerült betölteni a hibákat. Próbáld újra.",
    adminNoErrors: "Nem volt hiba az elmúlt 30 napban.",
    adminNone: "–",
    adminErrorGroups: {
      one: "{count} féle hiba az elmúlt 30 napban",
      other: "{count} féle hiba az elmúlt 30 napban",
    },
    adminOccurrences: {
      one: "{count} alkalommal fordult elő az elmúlt 30 napban",
      other: "{count} alkalommal fordult elő az elmúlt 30 napban",
    },
    // Where an error happened.
    adminErrorSources: {
      worker: "Szerver",
      page: "Böngésző",
    },
  },
};

export { adminErrors };
