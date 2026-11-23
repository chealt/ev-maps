import { formatNumber, message } from "#lib/messages.js";
import { formatDay, renderBarChart } from "@ev-maps/ui/bar-chart.js";

const SUMMARY_URL = "/api/admin/performance";
const TRACE_URL = "/api/admin/performance/traces";

const language = () => document.documentElement.lang || "en";

// Milliseconds as "123 ms" / "1.2 s"; CLS has no unit.
const formatDuration = (ms) =>
  ms < 1000
    ? message("adminMilliseconds", { value: formatNumber(Math.round(ms)) })
    : message("adminSeconds", { value: formatNumber(ms / 1000, { maximumFractionDigits: 1 }) });

const formatVital = (name, value) =>
  name === "CLS" ? formatNumber(value, { maximumFractionDigits: 3 }) : formatDuration(value);

const formatTime = (timestamp) =>
  new Intl.DateTimeFormat(language(), { dateStyle: "short", timeStyle: "medium" }).format(
    new Date(timestamp)
  );

// The view in the URL: ?days= for the summary, ?trace= for one trace.
const viewOf = () => {
  const params = new URL(window.location.href).searchParams;
  return { trace: params.get("trace"), days: Number(params.get("days")) || 7 };
};

const viewUrl = ({ trace, days }) => {
  const params = new URLSearchParams();
  if (trace) {
    params.set("trace", trace);
  } else if (days !== 7) {
    params.set("days", String(days));
  }
  const query = params.toString();
  return query ? `?${query}` : window.location.pathname;
};

class AdminPerformanceElement extends HTMLElement {
  connectedCallback() {
    this.summaryView = this.querySelector(".summary-view");
    this.traceView = this.querySelector(".trace-view");
    this.querySelector(".periods").addEventListener("click", (event) => {
      const button = event.target.closest(".period");
      if (button) {
        this.go({ trace: null, days: Number(button.dataset.days) });
      }
    });
    // Links within the page change the view without reloading it.
    this.addEventListener("click", (event) => {
      const link = event.target.closest("a[data-view]");
      if (link) {
        event.preventDefault();
        this.go(JSON.parse(link.dataset.view));
      }
    });
    this.querySelector(".trend-vitals").addEventListener("click", (event) => {
      const button = event.target.closest(".trend-vital");
      if (button) {
        this.trendVital = button.dataset.trend;
        this.renderTrend();
      }
    });
    this.querySelector(".all-performance").dataset.view = JSON.stringify({ trace: null, days: 7 });
    window.addEventListener("popstate", () => this.show(viewOf()));
    this.show(viewOf());
  }

  go(view) {
    window.history.pushState(null, "", viewUrl(view));
    this.show(view);
    window.scrollTo(0, 0);
  }

  async show(view) {
    this.summaryView.hidden = Boolean(view.trace);
    this.traceView.hidden = !view.trace;
    const section = view.trace ? this.traceView : this.summaryView;
    const url = view.trace ? `${TRACE_URL}/${view.trace}` : `${SUMMARY_URL}?days=${view.days}`;
    let data;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${url} failed: ${response.status}`);
      }
      data = await response.json();
    } catch (error) {
      console.error("Could not load the performance:", error);
      section.querySelector(".summary").textContent = message("adminPerformanceNotLoaded");
      return;
    }
    if (view.trace) {
      this.renderTrace(data);
    } else {
      this.renderSummary(data);
    }
  }

  // The chosen vital's P75 per day (LCP until another is picked).
  renderTrend() {
    const vital = this.trendVital ?? "LCP";
    for (const button of this.querySelectorAll(".trend-vital")) {
      button.setAttribute("aria-pressed", String(button.dataset.trend === vital));
    }
    const { days = [], vitals = {} } = this.vitalsByDay ?? {};
    if (!days.length) {
      return;
    }
    // A day without measurements says so, rather than showing a P75 of 0
    // (CLS can be a real 0).
    const measured = vitals[vital] ?? {};
    const dayOf = new Map(days.map((day) => [formatDay(day), day]));
    renderBarChart(this.querySelector(".vital-trend .bar-chart"), days, measured, (day, p75) =>
      message("adminVitalDay", {
        day,
        value:
          dayOf.get(day) in measured ? formatVital(vital, p75) : message("adminNoMeasurements"),
      })
    );
  }

  renderSummary(summary) {
    this.vitalsByDay = summary.vitalsByDay;
    this.renderTrend();
    for (const button of this.querySelectorAll(".period")) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.days) === summary.days));
    }
    this.summaryView.querySelector(".summary").textContent = message("adminPerformancePeriod", {
      count: summary.days,
    });
    for (const vital of this.querySelectorAll(".vital")) {
      const stats = summary.vitals.find(({ name }) => name === vital.dataset.vital);
      vital.querySelector(".value").textContent = stats ? formatVital(stats.name, stats.p75) : "–";
      vital.querySelector(".count").textContent = message("adminMeasurements", {
        count: stats?.count ?? 0,
      });
      vital.dataset.rating = stats?.rating ?? "";
    }
    const rowTemplate = this.querySelector(".timing-row-template");
    for (const table of this.querySelectorAll("[data-table]")) {
      const rows = summary[table.dataset.table] ?? [];
      table.querySelector(".empty").hidden = rows.length > 0;
      table.querySelector("tbody").replaceChildren(
        ...rows.map((stats) => {
          const row = rowTemplate.content.firstElementChild.cloneNode(true);
          row.querySelector(".name").textContent = stats.name;
          row.querySelector(".name").title = stats.name;
          row.querySelector(".count").textContent = formatNumber(stats.count);
          row.querySelector(".p75").textContent = formatDuration(stats.p75);
          row.querySelector(".p95").textContent = formatDuration(stats.p95);
          row.querySelector(".max").textContent = formatDuration(stats.max);
          row.querySelector(".errors").textContent = formatNumber(stats.errors ?? 0);
          return row;
        })
      );
    }
    const slowestTemplate = this.querySelector(".slowest-row-template");
    const slowest = this.querySelector(".slowest");
    slowest.closest(".timings").querySelector(".empty").hidden = summary.slowestRequests.length > 0;
    slowest.querySelector("tbody").replaceChildren(
      ...summary.slowestRequests.map((request) => {
        const row = slowestTemplate.content.firstElementChild.cloneNode(true);
        const link = row.querySelector(".trace-link");
        link.textContent = request.name;
        link.href = viewUrl({ trace: request.trace_id });
        link.dataset.view = JSON.stringify({ trace: request.trace_id, days: summary.days });
        row.querySelector(".path").textContent = request.path ?? "";
        row.querySelector(".duration").textContent = formatDuration(request.duration);
        row.querySelector(".when").textContent = formatTime(request.start_time);
        return row;
      })
    );
  }

  // The trace's spans as a waterfall: each bar placed by its start and length
  // within the whole trace, indented by its depth.
  renderTrace({ spans }) {
    const title = this.traceView.querySelector(".section-title");
    const summary = this.traceView.querySelector(".summary");
    const list = this.traceView.querySelector(".waterfall");
    if (!spans.length) {
      title.textContent = message("adminTraceNotFound");
      summary.textContent = "";
      list.replaceChildren();
      return;
    }
    const start = Math.min(...spans.map((span) => span.start_time));
    const end = Math.max(...spans.map((span) => span.start_time + span.duration));
    const total = Math.max(end - start, 1);
    const byId = new Map(spans.map((span) => [span.span_id, span]));
    const depthOf = (span) => {
      let depth = 0;
      for (
        let parent = byId.get(span.parent_span_id);
        parent;
        parent = byId.get(parent.parent_span_id)
      ) {
        depth++;
      }
      return depth;
    };
    const [root] = spans;
    title.textContent = root.name;
    summary.textContent = message("adminTraceSummary", {
      duration: formatDuration(total),
      count: spans.length,
      time: formatTime(start),
    });
    const template = this.querySelector(".span-template");
    list.replaceChildren(
      ...spans.map((span) => {
        const item = template.content.firstElementChild.cloneNode(true);
        item.dataset.service = span.service;
        item.dataset.status = span.status;
        item.style.setProperty("--depth", String(depthOf(span)));
        const bar = item.querySelector(".bar");
        bar.style.setProperty("--offset", String((span.start_time - start) / total));
        bar.style.setProperty("--width", String(span.duration / total));
        item.querySelector(".service").textContent = span.service;
        item.querySelector(".span-name").textContent = span.name;
        item.querySelector(".span-duration").textContent = formatDuration(span.duration);
        const statement = item.querySelector(".statement");
        statement.textContent =
          span.attributes["db.query.text"] ?? span.attributes["url.path"] ?? "";
        statement.title = statement.textContent;
        return item;
      })
    );
  }
}

customElements.define("ev-admin-performance", AdminPerformanceElement);

export { AdminPerformanceElement };
