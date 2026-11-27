// Magyar: the admin area's page of chargers reported unavailable (#371). See
// ../index.js for how the sections are put together and which pages get which.

const adminUnavailability = {
  page: {
    adminUnavailability: "Nem elérhető töltők",
    adminConfirmUnavailable: "Nem elérhetőnek jelölés",
    adminDismissUnavailable: "Elvetés",
  },
  messages: {
    adminUnavailabilityNotLoaded: "Nem sikerült betölteni a bejelentéseket. Próbáld újra.",
    adminNoUnavailability: "Nincs nem elérhetőnek bejelentett töltő.",
    adminUnavailabilityCount: {
      one: "{count} töltőt jelentettek nem elérhetőnek",
      other: "{count} töltőt jelentettek nem elérhetőnek",
    },
    adminUnavailabilityReporters: { one: "{count} személy", other: "{count} személy" },
    adminUnavailabilityPhotos: { one: "{count} fénykép", other: "{count} fénykép" },
    adminCurrentStatus: "Most: {status}",
  },
};

export { adminUnavailability };
