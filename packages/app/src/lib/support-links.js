// Where people can support EV Maps (monetization suggestion 1, #390; set-up
// and how to change them: docs/features/support.md):
// donations through GitHub Sponsors, Ko-fi (international, card or PayPal)
// and buycoffee.to (Polish: BLIK, PLN). Shown in the account menu, the
// language's own option first: Polish users get buycoffee.to first.
//
// Set `enabled: true` once the platform's account is set up and its page
// takes donations; the menu shows only the enabled ones, and hides the whole
// section while none is. Turn the same ones on in .github/FUNDING.yml.
const SUPPORT_LINKS = [
  {
    id: "github-sponsors",
    name: "GitHub Sponsors",
    url: "https://github.com/sponsors/chealt",
    enabled: true,
  },
  { id: "ko-fi", name: "Ko-fi", url: "https://ko-fi.com/chealt", enabled: true },
  {
    id: "buycoffee",
    name: "buycoffee.to",
    url: "https://buycoffee.to/chealt",
    lang: "pl",
    enabled: false,
  },
];

// The enabled links, the language's own first.
const supportLinks = (lang, links = SUPPORT_LINKS) => {
  const enabled = links.filter((link) => link.enabled);
  return [
    ...enabled.filter((link) => link.lang === lang),
    ...enabled.filter((link) => link.lang !== lang),
  ];
};

export { SUPPORT_LINKS, supportLinks };
