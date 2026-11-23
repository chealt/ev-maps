// A preference the user picks in the account menu, e.g. the maps app or the
// distance unit: one of `values`, or null for the default. It's kept in
// memory (so a click can act on it at once), on this device (localStorage),
// and, signed in, in the account (the Worker's settings, a section of its
// own), where the newer copy wins. Both keep { [field]: value, updatedAt }.

import { fetchAccountSettings, saveAccountSettings } from "./account-settings.js";
import { isSignedIn, onSessionChange } from "./session.js";

const createAccountPreference = ({ storageKey, section, field, values }) => {
  const isValue = (value) => value === null || values.includes(value);

  // { value, updatedAt }: updatedAt 0 is never chosen.
  const readLocal = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (isValue(saved?.[field]) && Number.isFinite(saved?.updatedAt)) {
        return { value: saved[field], updatedAt: saved.updatedAt };
      }
    } catch {
      // Storage can be unavailable, or hold something else.
    }
    return { value: null, updatedAt: 0 };
  };

  // As the account keeps it, e.g. { app: "osm", updatedAt }.
  const stored = () => ({ [field]: choice.value, updatedAt: choice.updatedAt });

  const saveLocal = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(stored()));
    } catch {
      // Storage can be unavailable; the choice lasts until the page is left.
    }
  };

  const saveToAccount = () => saveAccountSettings({ [section]: stored() });

  let choice = readLocal();
  const listeners = new Set();

  const adopt = (next) => {
    choice = next;
    saveLocal();
    for (const listener of listeners) {
      listener(choice.value);
    }
  };

  // Signed in: the account's choice if it's newer, else this device's to
  // the account.
  const syncWithAccount = async () => {
    const saved = (await fetchAccountSettings())?.[section];
    if (isValue(saved?.[field]) && saved.updatedAt > choice.updatedAt) {
      adopt({ value: saved[field], updatedAt: saved.updatedAt });
    } else if (choice.updatedAt > (saved?.updatedAt ?? 0)) {
      saveToAccount();
    }
  };

  onSessionChange((signedIn) => {
    if (signedIn) {
      syncWithAccount();
    }
  });
  if (isSignedIn()) {
    syncWithAccount();
  }

  return {
    // The chosen value, or null for the default.
    get: () => choice.value,
    // Chooses `value` (null: the default), here and in the account.
    set: (value) => {
      adopt({ value, updatedAt: Date.now() });
      if (isSignedIn()) {
        saveToAccount();
      }
    },
    // Calls `listener(value)` when the choice changes.
    onChange: (listener) => {
      listeners.add(listener);
    },
  };
};

export { createAccountPreference };
