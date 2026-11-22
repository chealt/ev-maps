import { describe, expect, test } from "bun:test";
import { canSendEmail, languageOf, sendSignInLink } from "./email.js";

const link = (callbackURL) =>
  `https://ev.chealt.com/api/auth/magic-link/verify?token=t&callbackURL=${encodeURIComponent(callbackURL)}`;

describe("languageOf", () => {
  test("takes the language from the page the link returns to", () => {
    expect(languageOf(link("/hu/hu/"))).toBe("hu");
    expect(languageOf(link("/pl/"))).toBe("pl");
    expect(languageOf(link("/"))).toBe("en");
    expect(languageOf(link("/xx/"))).toBe("en");
  });
});

describe("sendSignInLink", () => {
  test("sends it with Resend, in the page's language", async () => {
    const sent = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      sent.push({ url, init });
      return new Response("{}", { status: 200 });
    };
    try {
      const env = { RESEND_API_KEY: "key", EMAIL_FROM: "EV Maps <sign-in@chealt.com>" };
      expect(canSendEmail(env)).toBe(true);
      await sendSignInLink(env, { email: "ada@example.com", url: link("/pl/") });
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("https://api.resend.com/emails");
    expect(sent[0].init.headers.authorization).toBe("Bearer key");
    const body = JSON.parse(sent[0].init.body);
    expect(body).toMatchObject({
      to: "ada@example.com",
      subject: "Twój link do logowania w EV Maps",
    });
    expect(body.text).toContain(link("/pl/"));
  });

  test("only logs the link without an email service", async () => {
    expect(canSendEmail({})).toBe(false);
    await sendSignInLink({}, { email: "ada@example.com", url: link("/") });
  });
});
