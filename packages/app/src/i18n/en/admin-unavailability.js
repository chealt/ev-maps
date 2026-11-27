// English: the admin area's page of chargers reported unavailable (#371). See
// ../index.js for how the sections are put together and which pages get which.

const adminUnavailability = {
  page: {
    adminUnavailability: "Unavailable chargers",
    adminConfirmUnavailable: "Mark unavailable",
    adminDismissUnavailable: "Dismiss",
  },
  messages: {
    adminUnavailabilityNotLoaded: "The unavailability reports couldn't be loaded. Try again.",
    adminNoUnavailability: "No chargers reported unavailable.",
    adminUnavailabilityCount: {
      one: "{count} charger reported unavailable",
      other: "{count} chargers reported unavailable",
    },
    adminUnavailabilityReporters: { one: "{count} person", other: "{count} people" },
    adminUnavailabilityPhotos: { one: "{count} photo", other: "{count} photos" },
    adminCurrentStatus: "Now: {status}",
  },
};

export { adminUnavailability };
