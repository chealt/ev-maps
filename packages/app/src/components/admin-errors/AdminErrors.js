import { message, valueLabel } from "../../lib/messages.js";

const ERRORS_URL = "/api/admin/errors";

const language = () => document.documentElement.lang || "en";

const formatTime = (timestamp) =>
  new Intl.DateTimeFormat(language(), { dateStyle: "medium", timeStyle: "medium" }).format(
    new Date(timestamp)
  );

// "5 minutes ago", "yesterday"...
const timeAgo = (timestamp) => {
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const format = new Intl.RelativeTimeFormat(language(), { numeric: "auto" });
  const units = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return format.format(Math.round(seconds / size), unit);
    }
  }
  return format.format(seconds, "second");
};

// The view in the page's URL: ?page=, and ?error= for one error's details.
const viewOf = () => {
  const params = new URL(window.location.href).searchParams;
  return {
    error: params.get("error"),
    page: Math.max(1, Number.parseInt(params.get("page"), 10) || 1),
  };
};

const viewUrl = ({ error, page }) => {
  const params = new URLSearchParams();
  if (error) {
    params.set("error", error);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `?${query}` : window.location.pathname;
};

class AdminErrorsElement extends HTMLElement {
  connectedCallback() {
    this.groupsView = this.querySelector(".groups-view");
    this.groupView = this.querySelector(".group-view");
    for (const view of [this.groupsView, this.groupView]) {
      view.querySelector(".previous").addEventListener("click", () => this.turnPage(-1));
      view.querySelector(".next").addEventListener("click", () => this.turnPage(1));
    }
    // Links within the page change the view without reloading it.
    this.addEventListener("click", (event) => {
      const link = event.target.closest("a[data-view]");
      if (link) {
        event.preventDefault();
        this.go(JSON.parse(link.dataset.view));
      }
    });
    this.querySelector(".all-errors").dataset.view = JSON.stringify({ error: null, page: 1 });
    window.addEventListener("popstate", () => this.show(viewOf()));
    this.show(viewOf());
  }

  go(view) {
    window.history.pushState(null, "", viewUrl(view));
    this.show(view);
    window.scrollTo(0, 0);
  }

  turnPage(step) {
    const view = viewOf();
    this.go({ ...view, page: view.page + step });
  }

  async show(view) {
    this.groupsView.hidden = Boolean(view.error);
    this.groupView.hidden = !view.error;
    const url = view.error ? `${ERRORS_URL}/${view.error}` : ERRORS_URL;
    const section = view.error ? this.groupView : this.groupsView;
    const summary = section.querySelector(".summary");
    let data;
    try {
      const response = await fetch(`${url}?page=${view.page}`);
      if (!response.ok) {
        throw new Error(`${url} failed: ${response.status}`);
      }
      data = await response.json();
    } catch (error) {
      console.error("Could not load the errors:", error);
      summary.textContent = message("adminErrorsNotLoaded");
      return;
    }
    if (view.error) {
      this.renderOccurrences(data);
    } else {
      this.renderGroups(data);
    }
    this.renderPager(section, data);
  }

  renderPager(section, { page, pages }) {
    section.querySelector(".page-of").textContent = message("adminPageOf", { page, pages });
    section.querySelector(".previous").disabled = page <= 1;
    section.querySelector(".next").disabled = page >= pages;
    section.querySelector(".pager").hidden = pages <= 1;
  }

  renderGroups({ groups, total }) {
    this.groupsView.querySelector(".summary").textContent =
      total === 0 ? message("adminNoErrors") : message("adminErrorGroups", { count: total });
    const template = this.querySelector(".group-template");
    this.groupsView.querySelector("tbody").replaceChildren(
      ...groups.map((group) => {
        const row = template.content.firstElementChild.cloneNode(true);
        const link = row.querySelector(".message");
        link.textContent = `${group.name ? `${group.name}: ` : ""}${group.message}`;
        link.href = viewUrl({ error: group.fingerprint, page: 1 });
        link.dataset.view = JSON.stringify({ error: group.fingerprint, page: 1 });
        row.querySelector(".where").textContent = group.context ?? group.url ?? "";
        row.querySelector(".source").textContent = valueLabel("errorSources", group.source);
        row.querySelector(".count").textContent = String(group.count);
        row.querySelector(".users").textContent = String(group.users);
        const lastSeen = row.querySelector(".last-seen");
        lastSeen.textContent = timeAgo(group.last_seen);
        lastSeen.title = formatTime(group.last_seen);
        const firstSeen = row.querySelector(".first-seen");
        firstSeen.textContent = timeAgo(group.first_seen);
        firstSeen.title = formatTime(group.first_seen);
        return row;
      })
    );
  }

  renderOccurrences({ occurrences, total }) {
    const [latest] = occurrences;
    this.groupView.querySelector(".section-title").textContent = latest
      ? `${latest.name ? `${latest.name}: ` : ""}${latest.message}`
      : message("adminNoErrors");
    this.groupView.querySelector(".summary").textContent = message("adminOccurrences", {
      count: total,
    });
    const template = this.querySelector(".occurrence-template");
    const none = message("adminNone");
    this.groupView.querySelector(".occurrences").replaceChildren(
      ...occurrences.map((occurrence) => {
        const item = template.content.firstElementChild.cloneNode(true);
        const fill = (selector, value) => {
          item.querySelector(selector).textContent = value || none;
        };
        fill(".time", formatTime(occurrence.created_at));
        fill(".url", [occurrence.method, occurrence.url].filter(Boolean).join(" "));
        fill(".context", occurrence.context);
        fill(".user-agent", occurrence.user_agent);
        fill(".user", occurrence.user_id);
        fill(".country", occurrence.country);
        fill(".stack", occurrence.stack);
        return item;
      })
    );
  }
}

customElements.define("ev-admin-errors", AdminErrorsElement);

export { AdminErrorsElement };
