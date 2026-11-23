// Fakes the Worker's auth API (/api/auth/*, Better Auth). Signing in skips
// the provider's page: the fake sends the browser straight back to the
// callback URL, signed in. Returns the sign-in requests' bodies.
const ADA = { id: "user-1", name: "Ada Lovelace", email: "ada@example.com", image: null };

const fakeAuthApi = async (
  page,
  {
    signedIn = false,
    user = ADA,
    signInStatus = 200,
    providers = ["google"],
    passkeys = [],
    magicLinkStatus = 200,
  } = {}
) => {
  const state = { signedIn, passkeys: [...passkeys] };
  const signInRequests = [];
  await page.route("**/api/sign-in-providers", (route) => route.fulfill({ json: { providers } }));
  await page.route("**/api/auth/get-session", (route) =>
    route.fulfill({ json: state.signedIn ? { session: { userId: user.id }, user } : null })
  );
  await page.route("**/api/auth/sign-in/social", (route) => {
    const body = route.request().postDataJSON();
    signInRequests.push(body);
    if (signInStatus !== 200) {
      return route.fulfill({ status: signInStatus, json: { message: "Sign-in failed" } });
    }
    state.signedIn = true;
    return route.fulfill({ json: { url: body.callbackURL, redirect: true } });
  });
  await page.route("**/api/auth/sign-out", (route) => {
    state.signedIn = false;
    return route.fulfill({ json: { success: true } });
  });
  // Sign-in links: recorded with the email and where they return to.
  await page.route("**/api/auth/sign-in/magic-link", (route) => {
    signInRequests.push({ magicLink: route.request().postDataJSON() });
    return route.fulfill({ status: magicLinkStatus, json: { status: magicLinkStatus === 200 } });
  });
  // Passkeys: real WebAuthn options for localhost (the browser's virtual
  // authenticator answers them); verifying always succeeds.
  const challenge = "dGVzdC1jaGFsbGVuZ2UtZm9yLWV2LW1hcHM";
  await page.route("**/api/auth/passkey/list-user-passkeys", (route) =>
    route.fulfill({ json: state.passkeys })
  );
  await page.route("**/api/auth/passkey/generate-register-options", (route) =>
    route.fulfill({
      json: {
        challenge,
        rp: { name: "EV Maps", id: "localhost" },
        user: { id: "dXNlci0x", name: user.email, displayName: user.email },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
        attestation: "none",
        excludeCredentials: [],
      },
    })
  );
  await page.route("**/api/auth/passkey/verify-registration", (route) => {
    signInRequests.push({ passkeyRegistration: route.request().postDataJSON() });
    state.passkeys.push({ id: "passkey-1" });
    return route.fulfill({ json: { id: "passkey-1" } });
  });
  await page.route("**/api/auth/passkey/generate-authenticate-options", (route) =>
    route.fulfill({
      json: { challenge, rpId: "localhost", allowCredentials: [], userVerification: "preferred" },
    })
  );
  await page.route("**/api/auth/passkey/verify-authentication", (route) => {
    signInRequests.push({ passkeyAuthentication: route.request().postDataJSON() });
    state.signedIn = true;
    return route.fulfill({ json: { session: { userId: user.id } } });
  });
  return signInRequests;
};

// A WebAuthn authenticator in the browser (Chromium's virtual one) that
// says yes without a prompt, so passkeys can be added and used in tests.
const addVirtualAuthenticator = async (page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
};

export { addVirtualAuthenticator, fakeAuthApi };
