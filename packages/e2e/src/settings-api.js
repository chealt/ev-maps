// Fakes the Worker's account settings (/api/settings): starts with
// `settings`, keeps what's saved, and records the saved bodies.
const fakeSettingsApi = async (page, settings = {}) => {
  const state = { settings: structuredClone(settings) };
  const saves = [];
  await page.route("**/api/settings", (route) => {
    if (route.request().method() === "PUT") {
      const changes = route.request().postDataJSON();
      saves.push(changes);
      state.settings = { ...state.settings, ...changes };
    }
    return route.fulfill({ json: { settings: state.settings } });
  });
  return saves;
};

export { fakeSettingsApi };
