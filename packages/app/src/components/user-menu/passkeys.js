// Passkeys (WebAuthn) and sign-in links through the Worker's Better Auth
// (packages/worker/src/auth.js). A passkey can only be added signed in, i.e.
// after the email has been verified by a sign-in link or a provider.
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

const AUTH_URL = "/api/auth";

const postJson = (url, body) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const getJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status}`);
  }
  return response.json();
};

const supportsPasskeys = () => browserSupportsWebAuthn();

// The person cancelled the browser's passkey dialog (or it timed out).
const isCancelled = (error) => error?.name === "NotAllowedError" || error?.name === "AbortError";

// Signs in with a passkey; resolves to "signed-in", "cancelled" or "failed".
const signInWithPasskey = async () => {
  try {
    const options = await getJson(`${AUTH_URL}/passkey/generate-authenticate-options`);
    const response = await startAuthentication({ optionsJSON: options });
    const verified = await postJson(`${AUTH_URL}/passkey/verify-authentication`, { response });
    return verified.ok ? "signed-in" : "failed";
  } catch (error) {
    if (isCancelled(error)) {
      return "cancelled";
    }
    console.error("Passkey sign-in failed:", error);
    return "failed";
  }
};

// Adds a passkey to the signed-in account; "added", "cancelled" or "failed".
const addPasskey = async () => {
  try {
    const options = await getJson(`${AUTH_URL}/passkey/generate-register-options`);
    const response = await startRegistration({ optionsJSON: options });
    const verified = await postJson(`${AUTH_URL}/passkey/verify-registration`, { response });
    return verified.ok ? "added" : "failed";
  } catch (error) {
    if (isCancelled(error) || error?.name === "InvalidStateError") {
      // InvalidStateError: this authenticator already has the passkey.
      return error?.name === "InvalidStateError" ? "added" : "cancelled";
    }
    console.error("Adding a passkey failed:", error);
    return "failed";
  }
};

// Whether the signed-in account has a passkey (true when it can't be told,
// so nobody is pressed to add one twice).
const hasPasskey = async () => {
  try {
    const passkeys = await getJson(`${AUTH_URL}/passkey/list-user-passkeys`);
    return passkeys.length > 0;
  } catch {
    return true;
  }
};

// Emails a sign-in link; "sent", "too-many" or "failed".
const sendSignInLink = async (email, { callbackURL, errorCallbackURL }) => {
  try {
    const response = await postJson(`${AUTH_URL}/sign-in/magic-link`, {
      email,
      callbackURL,
      errorCallbackURL,
    });
    if (response.status === 429) {
      return "too-many";
    }
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
};

export { addPasskey, hasPasskey, sendSignInLink, signInWithPasskey, supportsPasskeys };
