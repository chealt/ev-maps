// Danish: the admin area's page of chargers reported unavailable (#371). See
// ../index.js for how the sections are put together and which pages get which.

const adminUnavailability = {
  page: {
    adminUnavailability: "Utilgængelige ladestandere",
    adminConfirmUnavailable: "Markér som utilgængelig",
    adminDismissUnavailable: "Afvis",
  },
  messages: {
    adminUnavailabilityNotLoaded: "Rapporterne om utilgængelighed kunne ikke indlæses. Prøv igen.",
    adminNoUnavailability: "Ingen ladestandere er rapporteret utilgængelige.",
    adminUnavailabilityCount: {
      one: "{count} ladestander rapporteret utilgængelig",
      other: "{count} ladestandere rapporteret utilgængelige",
    },
    adminUnavailabilityReporters: { one: "{count} person", other: "{count} personer" },
    adminUnavailabilityPhotos: { one: "{count} foto", other: "{count} fotos" },
    adminCurrentStatus: "Nu: {status}",
  },
};

export { adminUnavailability };
