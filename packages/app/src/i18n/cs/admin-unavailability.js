// Czech: the admin area's page of chargers reported unavailable (#371). See
// ../index.js for how the sections are put together and which pages get which.

const adminUnavailability = {
  page: {
    adminUnavailability: "Nedostupné nabíječky",
    adminConfirmUnavailable: "Označit jako nedostupnou",
    adminDismissUnavailable: "Zamítnout",
  },
  messages: {
    adminUnavailabilityNotLoaded: "Hlášení o nedostupnosti se nepodařilo načíst. Zkuste to znovu.",
    adminNoUnavailability: "Žádné nabíječky nahlášené jako nedostupné.",
    adminUnavailabilityCount: {
      one: "{count} nabíječka nahlášená jako nedostupná",
      few: "{count} nabíječky nahlášené jako nedostupné",
      other: "{count} nabíječek nahlášených jako nedostupné",
    },
    adminUnavailabilityReporters: {
      one: "{count} osoba",
      few: "{count} osoby",
      other: "{count} osob",
    },
    adminUnavailabilityPhotos: {
      one: "{count} fotografie",
      few: "{count} fotografie",
      other: "{count} fotografií",
    },
    adminCurrentStatus: "Nyní: {status}",
  },
};

export { adminUnavailability };
