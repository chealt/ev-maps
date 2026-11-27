// Swedish: the admin area's page of chargers reported unavailable (#371). See
// ../index.js for how the sections are put together and which pages get which.

const adminUnavailability = {
  page: {
    adminUnavailability: "Otillgängliga laddstationer",
    adminConfirmUnavailable: "Markera som otillgänglig",
    adminDismissUnavailable: "Avvisa",
  },
  messages: {
    adminUnavailabilityNotLoaded: "Rapporterna om otillgänglighet kunde inte laddas. Försök igen.",
    adminNoUnavailability: "Inga laddstationer har rapporterats som otillgängliga.",
    adminUnavailabilityCount: {
      one: "{count} laddstation rapporterad som otillgänglig",
      other: "{count} laddstationer rapporterade som otillgängliga",
    },
    adminUnavailabilityReporters: { one: "{count} person", other: "{count} personer" },
    adminUnavailabilityPhotos: { one: "{count} foto", other: "{count} foton" },
    adminCurrentStatus: "Nu: {status}",
  },
};

export { adminUnavailability };
