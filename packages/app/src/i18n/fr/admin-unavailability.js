// Français: the admin area's page of chargers reported unavailable (#371). See
// ../index.js for how the sections are put together and which pages get which.

const adminUnavailability = {
  page: {
    adminUnavailability: "Bornes indisponibles",
    adminConfirmUnavailable: "Marquer indisponible",
    adminDismissUnavailable: "Ignorer",
  },
  messages: {
    adminUnavailabilityNotLoaded:
      "Les signalements d'indisponibilité n'ont pas pu être chargés. Réessaie.",
    adminNoUnavailability: "Aucune borne signalée indisponible.",
    adminUnavailabilityCount: {
      one: "{count} borne signalée indisponible",
      other: "{count} bornes signalées indisponibles",
    },
    adminUnavailabilityReporters: { one: "{count} personne", other: "{count} personnes" },
    adminUnavailabilityPhotos: { one: "{count} photo", other: "{count} photos" },
    adminCurrentStatus: "Actuellement : {status}",
  },
};

export { adminUnavailability };
