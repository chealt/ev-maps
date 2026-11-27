import { formatNumber, message } from "@ev-maps/ui/messages.js";
import { fetchJson } from "@ev-maps/ui/fetch-json.js";

const PREFERENCES_URL = "/api/admin/preferences";

const language = () => document.documentElement.lang || "en";

// Languages read as their names, e.g. "hu" → "Hungarian".
const languageName = (code) => {
  try {
    return new Intl.DisplayNames(language(), { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
};

class AdminPreferencesElement extends HTMLElement {
  connectedCallback() {
    this.labels = JSON.parse(this.dataset.labels || "{}");
    this.load();
  }

  async load() {
    const summary = this.querySelector(".summary");
    let stats;
    try {
      stats = await fetchJson(PREFERENCES_URL);
    } catch (error) {
      console.error("Could not load the preferences:", error);
      summary.textContent = message("adminPreferencesNotLoaded");
      return;
    }
    summary.textContent = message("adminPreferencesAccounts", { count: stats.accounts });
    for (const section of this.querySelectorAll(".group")) {
      this.renderGroup(section, stats.groups[section.dataset.group], stats);
    }
  }

  label(group, value) {
    if (group === "language") {
      return languageName(value);
    }
    return this.labels[group]?.[value] ?? value;
  }

  // A group's rows, each with its share of the accounts (or of the page
  // views, which add up to all of them).
  renderGroup(section, group = { unit: "users", rows: [] }, { accounts, pageViewDays }) {
    const { unit, rows } = group;
    const total =
      unit === "pageViews" ? rows.reduce((sum, { count }) => sum + count, 0) : accounts;
    section.querySelector(".unit").textContent =
      unit === "pageViews"
        ? message("adminPreferencePageViews", { days: pageViewDays })
        : message("adminPreferenceUsers");
    section.querySelector(".empty").hidden = rows.length > 0;
    section.querySelector(".table").hidden = rows.length === 0;
    const template = this.querySelector(".row-template");
    section.querySelector("tbody").replaceChildren(
      ...rows.map(({ value, count }) => {
        const row = template.content.firstElementChild.cloneNode(true);
        const share = total > 0 ? count / total : 0;
        row.querySelector(".name").textContent = this.label(section.dataset.group, value);
        row.querySelector(".share-fill").style.width = `${Math.round(share * 100)}%`;
        row.querySelector(".count").textContent = message("adminPreferenceCount", {
          count,
          share: formatNumber(share, { style: "percent" }),
        });
        return row;
      })
    );
  }
}

customElements.define("ev-admin-preferences", AdminPreferencesElement);

export { AdminPreferencesElement };
