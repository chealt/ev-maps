// Français: the admin area's errors page. See ../index.js for how
// the sections are put together and which pages get which.

const adminErrors = {
  page: {
    adminErrorColumn: "Erreur",
    adminSourceColumn: "Où",
    adminBrowserColumn: "Navigateur",
    adminOsColumn: "Système",
    adminErrorFilters: "Filtrer les erreurs",
    adminFilterAll: "Toutes",
    adminFilterSearch: "Rechercher",
    adminFilterApply: "Appliquer",
    adminFilterClear: "Effacer les filtres",
    adminCountColumn: "Fois",
    adminUsersColumn: "Utilisateurs",
    adminLastSeenColumn: "Vue en dernier",
    adminFirstSeenColumn: "Vue en premier",
    adminPages: "Pages",
    adminPreviousPage: "Précédente",
    adminNextPage: "Suivante",
    adminAllErrors: "Toutes les erreurs",
    adminTimeLabel: "Heure",
    adminUrlLabel: "URL",
    adminContextLabel: "Tâche",
    adminBrowserLabel: "Navigateur",
    adminUserLabel: "Utilisateur",
    adminCountryLabel: "Pays",
    adminStackTrace: "Trace de la pile",
    adminErrorsNotLoaded: "Les erreurs n'ont pas pu être chargées. Réessaie.",
    adminNoErrors: "Aucune erreur ces 30 derniers jours.",
    adminNone: "–",
    adminErrorGroups: {
      one: "{count} type d'erreur ces 30 derniers jours",
      other: "{count} types d'erreurs ces 30 derniers jours",
    },
    adminOccurrences: {
      one: "Survenue {count} fois ces 30 derniers jours",
      other: "Survenue {count} fois ces 30 derniers jours",
    },
    // Where an error happened.
    adminErrorSources: {
      worker: "Serveur",
      page: "Navigateur",
    },
  },
};

export { adminErrors };
