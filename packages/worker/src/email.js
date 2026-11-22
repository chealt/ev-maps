// Sends the sign-in link emails (Better Auth's magic link, src/auth.js) with
// Resend's API (https://resend.com), as EMAIL_FROM. Without RESEND_API_KEY,
// e.g. locally, the link is only logged, and the page can't offer email.

const RESEND_URL = "https://api.resend.com/emails";

// The sign-in email in the page's language: the first part of the link's
// callback path, e.g. /hu/hu/ → hu.
const MESSAGES = {
  en: {
    subject: "Your EV Maps sign-in link",
    text: (url) =>
      `Open this link to sign in to EV Maps:\n\n${url}\n\nIt works once, within 15 minutes. If you didn't ask for it, ignore this email.`,
  },
  pl: {
    subject: "Twój link do logowania w EV Maps",
    text: (url) =>
      `Otwórz ten link, aby zalogować się do EV Maps:\n\n${url}\n\nDziała jeden raz, przez 15 minut. Jeśli to nie Ty o niego prosiłeś, zignoruj tę wiadomość.`,
  },
  hu: {
    subject: "Az EV Maps bejelentkezési linked",
    text: (url) =>
      `Nyisd meg ezt a linket az EV Maps-be való bejelentkezéshez:\n\n${url}\n\nEgyszer használható, 15 percig. Ha nem te kérted, hagyd figyelmen kívül ezt a levelet.`,
  },
};

const languageOf = (url) => {
  const callback = new URL(url).searchParams.get("callbackURL") ?? "";
  const lang = callback.split("/")[1];
  return Object.hasOwn(MESSAGES, lang) ? lang : "en";
};

const canSendEmail = (env) => Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);

const sendSignInLink = async (env, { email, url }) => {
  if (!canSendEmail(env)) {
    console.log(`Sign-in link for ${email} (no email service configured): ${url}`);
    return;
  }
  const { subject, text } = MESSAGES[languageOf(url)];
  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: email, subject, text: text(url) }),
  });
  if (!response.ok) {
    throw new Error(`Resend failed: ${response.status} ${await response.text()}`);
  }
};

export { canSendEmail, languageOf, sendSignInLink };
