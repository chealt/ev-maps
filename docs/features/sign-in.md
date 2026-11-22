# Sign-in

The box in the top-right corner shows the app's name (the
page's `<h1>`, visible for Google's OAuth verification) and the avatar;
clicking anywhere on it opens the account menu, with
the sign-in options, the theme and the language (signed in: the profile and
Sign out). Signing in goes through the Worker's
[Better Auth](https://www.better-auth.com) (`/api/auth/*`): the provider's
OAuth page, then back to the same page with an httpOnly session cookie. Or
an emailed link (Better Auth's magic link, sent with Resend), which verifies
the address and creates the account the first time; signed in, the menu
offers to add a passkey (WebAuthn, `@better-auth/passkey`), and "Sign in
with a passkey" works from then on. Only users with a verified email count
as signed in for the API (`userIdOf` in `src/auth.js`).
Users, accounts and sessions are in D1, and the page reads the session from
`/api/auth/get-session` on every load.
