// Settings saved to the signed-in user's account (the Worker's
// /api/settings): sections such as `filters`, each with `updatedAt`. Signed
// out, or offline, these return null or false; the page keeps its local copy
// (IndexedDB) either way.

const SETTINGS_URL = "/api/settings";

const fetchAccountSettings = async () => {
  try {
    const response = await fetch(SETTINGS_URL);
    return response.ok ? (await response.json()).settings : null;
  } catch {
    return null;
  }
};

// Saves sections ({ filters: {...} }); true if the account has them now.
const saveAccountSettings = async (sections) => {
  try {
    const response = await fetch(SETTINGS_URL, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sections),
    });
    return response.ok;
  } catch {
    return false;
  }
};

export { fetchAccountSettings, saveAccountSettings };
