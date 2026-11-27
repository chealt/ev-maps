# Supporting EV Maps

EV Maps is free. People who want to help pay for its servers and map data can
donate through three platforms, linked from the account menu's **Support EV
Maps** section and from the repository's **Sponsor** button (#396,
suggestion 1 of #390). EV Maps itself handles no money and no payment data.
Each platform takes the payment, pays it out, and sends its own receipts.

## The Platforms

| Platform        | For                                    | Link                                 | Fee (roughly)                                       |
| --------------- | -------------------------------------- | ------------------------------------ | --------------------------------------------------- |
| GitHub Sponsors | developers, monthly or one-time        | `https://github.com/sponsors/chealt` | none for personal accounts                          |
| Ko-fi           | everyone, card or PayPal, any currency | `https://ko-fi.com/chealt`           | 0% on donations (plus Stripe's or PayPal's own fee) |
| buycoffee.to    | Poland: BLIK, Przelewy24, card, PLN    | `https://buycoffee.to/chealt`        | a small percentage per donation                     |

Polish pages list buycoffee.to first. Every other language lists GitHub
Sponsors first.

## Set-Up (One-Time, by the Owner)

The links only work once the accounts exist, so every platform starts
**disabled**: the account menu hides the section and GitHub shows no Sponsor
button. Set up each account, then enable it:

1. **GitHub Sponsors.** Go to <https://github.com/sponsors> and choose
   _Get started_ for the `chealt` account (personal or organization).
   - Fill in the profile: a short "why", and one or more tiers (for example,
     one-time amounts and a monthly tier).
   - Connect a payout: a bank account via Stripe Connect. Hungary is a
     supported region. Add the tax form (W-8BEN for non-US individuals).
   - Submit it. GitHub reviews it, usually within days.
     `github.com/sponsors/chealt` redirects to the profile until it's
     approved.
2. **Ko-fi.** Sign up at <https://ko-fi.com>, and pick `chealt` as the page
   name so the URL is `ko-fi.com/chealt`.
   - Connect Stripe and/or PayPal under _Settings → Payments_. Without one,
     the page can't take donations.
   - Optionally set the suggested amount ("coffee" price) and currency (EUR).
3. **buycoffee.to.** Sign up at <https://buycoffee.to>, choose `chealt` as the
   profile name (the URL is `buycoffee.to/chealt`), and verify your identity
   and bank account (they need a Polish or EU IBAN for PLN payouts).
4. **Check the links.** Open the three URLs above in a private window: each
   should show a donation page, not a 404 or a sign-in page.
5. **Enable it** (see below), for each platform that works.
6. **If a name was taken,** change its URL in both places listed below.

## Enabling a Platform

In `packages/app/src/lib/support-links.js`, set the platform's
`enabled: false` to `enabled: true`. In `.github/FUNDING.yml`, uncomment its
line (`github:`, `ko_fi:`, or `custom:` with the buycoffee.to URL under it).
Then open a pull request. The account menu shows only the enabled
platforms, and shows the section once at least one is enabled. The
`sign-in.spec.js` test follows the config, so it needs no change. Disable a
platform the same way, by setting it back to `false` and commenting its line
out again.

### Taxes and Bookkeeping

Donations are income. Check with an accountant how to declare them in Hungary
(e.g. as an individual's other income, or through a sole proprietorship).
Each platform gives a yearly or monthly payout statement to use for it.
GitHub also asks for a US tax form, but doesn't withhold US tax from non-US
individuals who file one.

## Where the Links Live

- **`packages/app/src/lib/support-links.js`:** the list the account menu
  shows: each platform's `id`, `name`, `url`, `enabled`, and an optional
  `lang` that puts it first for that language. Its unit tests are in
  `support-links.test.js`.
- **`.github/FUNDING.yml`:** the repository's Sponsor button. It takes
  GitHub's own keys (`github`, `ko_fi`, `custom`). Keep it in step with
  `support-links.js`. Every line starts commented out.
- **The account menu:** `components/user-menu/UserMenu.astro` renders the
  section, for everyone (signed in or not), above the legal links, while at
  least one platform is enabled. Links
  open in a new tab, and screen readers hear "(opens in a new tab)".
- **Texts:** `supportTitle`, `supportHint` and `opensInNewTab` in each
  language's `src/i18n/{lang}/common.js`.
- **Tests:** an `@ui` test in `components/user-menu/sign-in.spec.js` checks
  the enabled links, their order and the Polish order, or that the section
  is hidden while none is enabled.

## Changing the Platforms

- **Add one:** add an entry to `SUPPORT_LINKS` with `enabled: false` (and
  `lang` if it's for one language's users), add it to `.github/FUNDING.yml`
  (as `custom` if GitHub has no key for it, commented out until it's
  enabled), and add it to the expected order in `support-links.test.js`.
- **Remove one:** delete it from both files and the tests.
- **A new language** needs the three texts in its `common.js`. The list
  itself is the same for every language.

## Privacy

The links are plain links: EV Maps sends the platforms nothing, and nothing
is tracked when someone clicks one. What someone enters on a platform falls
under that platform's privacy policy, so the privacy policy needs no change.
