// Français: the admin area's frame: navigation, overview. See ../index.js for how
// the sections are put together and which pages get which.

const admin = {
  page: {
    adminOverview: "Vue d'ensemble",
    adminGroupCommunity: "Communauté",
    adminGroupInsights: "Statistiques",
    adminGroupEngineering: "Technique",
    adminCollapseNav: "Réduire la navigation",
    adminFilterRows: "Filtrer les lignes",
    adminNoMatchingRows: "Aucune ligne ne correspond.",
    adminErrors: "Erreurs",
    adminUsage: "Utilisation",
  },
  messages: {
    adminSignedInAs: "Connecté en tant que {email}",
    adminSignedOut: "Connecte-toi avec un compte admin pour voir cette page.",
    // Shared by the admin pages with pages.
    adminPageOf: "Page {page} sur {pages}",
    // A bar of a chart (components/bar-chart).
    adminDayCount: "{day} : {count}",
  },
};

export { admin };
