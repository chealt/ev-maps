// The page is rendered on the server: choosing another period shows it with
// that ?days=; choosing another vital shows its chart, already rendered.
class AdminPerformanceElement extends HTMLElement {
  connectedCallback() {
    this.querySelector(".periods")?.addEventListener("change", (event) => {
      const days = event.target.value;
      window.location.assign(days === "7" ? window.location.pathname : `?days=${days}`);
    });
    this.querySelector(".trend-vitals")?.addEventListener("change", (event) => {
      for (const chart of this.querySelectorAll(".trend-chart")) {
        chart.hidden = chart.dataset.trend !== event.target.value;
      }
    });
  }
}

customElements.define("ev-admin-performance", AdminPerformanceElement);

export { AdminPerformanceElement };
