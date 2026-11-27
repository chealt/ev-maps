// Slovak: the admin area's page of chargers reported unavailable (#371). See
// ../index.js for how the sections are put together and which pages get which.

const adminUnavailability = {
  page: {
    adminUnavailability: "Nedostupné nabíjačky",
    adminConfirmUnavailable: "Označiť ako nedostupnú",
    adminDismissUnavailable: "Zamietnuť",
  },
  messages: {
    adminUnavailabilityNotLoaded:
      "Hlásenia o nedostupnosti sa nepodarilo načítať. Skúste to znova.",
    adminNoUnavailability: "Žiadne nabíjačky nahlásené ako nedostupné.",
    adminUnavailabilityCount: {
      one: "{count} nabíjačka nahlásená ako nedostupná",
      few: "{count} nabíjačky nahlásené ako nedostupné",
      other: "{count} nabíjačiek nahlásených ako nedostupné",
    },
    adminUnavailabilityReporters: {
      one: "{count} osoba",
      few: "{count} osoby",
      other: "{count} osôb",
    },
    adminUnavailabilityPhotos: {
      one: "{count} fotografia",
      few: "{count} fotografie",
      other: "{count} fotografií",
    },
    adminCurrentStatus: "Teraz: {status}",
  },
};

export { adminUnavailability };
