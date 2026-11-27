// Where people can support EV Maps (monetization suggestion 1, #390; set-up
// and how to change them: docs/features/support.md):
// donations through GitHub Sponsors, Ko-fi (international, card or PayPal)
// and buycoffee.to (Polish: BLIK, PLN). Shown in the account menu, the
// language's own option first: Polish users get buycoffee.to first.
const SUPPORT_LINKS = [
  { id: "github-sponsors", name: "GitHub Sponsors", url: "https://github.com/sponsors/chealt" },
  { id: "ko-fi", name: "Ko-fi", url: "https://ko-fi.com/chealt" },
  { id: "buycoffee", name: "buycoffee.to", url: "https://buycoffee.to/chealt", lang: "pl" },
];

const supportLinks = (lang) => [
  ...SUPPORT_LINKS.filter((link) => link.lang === lang),
  ...SUPPORT_LINKS.filter((link) => link.lang !== lang),
];

export { SUPPORT_LINKS, supportLinks };
