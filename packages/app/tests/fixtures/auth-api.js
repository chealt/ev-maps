// Fakes the Worker's auth API (/api/auth/*, Better Auth). Signing in skips
// the provider's page: the fake sends the browser straight back to the
// callback URL, signed in. Returns the sign-in requests' bodies.
const ADA = { id: "user-1", name: "Ada Lovelace", email: "ada@example.com", image: null };

const fakeAuthApi = async (page, { signedIn = false, user = ADA, signInStatus = 200 } = {}) => {
  const state = { signedIn };
  const signInRequests = [];
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
  return signInRequests;
};

export { fakeAuthApi };
