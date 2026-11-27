// <ev-table> (Table.astro): sorts its rows by a column header, and filters
// them by what's typed in its search field. Only the rows the page has.

import { compare, sortValue } from "./sort-value.js";

class TableElement extends HTMLElement {
  connectedCallback() {
    this.table = this.querySelector("table");
    this.body = this.table.tBodies[0];
    if (!this.body) {
      return;
    }
    if (this.hasAttribute("data-sortable")) {
      this.makeSortable();
    }
    const search = this.querySelector(".table-filter input");
    search?.addEventListener("input", () => this.filter(search.value));
  }

  // Each column header becomes a button; aria-sort says how it's sorted.
  makeSortable() {
    const headers = [...(this.table.tHead?.rows[0]?.cells ?? [])];
    headers.forEach((header, column) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sort";
      button.append(...header.childNodes);
      header.append(button);
      button.addEventListener("click", () => {
        const ascending = header.getAttribute("aria-sort") !== "ascending";
        headers.forEach((other) => other.removeAttribute("aria-sort"));
        header.setAttribute("aria-sort", ascending ? "ascending" : "descending");
        this.sort(column, ascending);
      });
    });
  }

  sort(column, ascending) {
    const rows = [...this.body.rows];
    rows.sort((a, b) => {
      const order = compare(sortValue(a.cells[column]), sortValue(b.cells[column]));
      return ascending ? order : -order;
    });
    this.body.append(...rows);
  }

  filter(text) {
    const query = text.trim().toLocaleLowerCase();
    let shown = 0;
    for (const row of this.body.rows) {
      row.hidden = Boolean(query) && !row.textContent.toLocaleLowerCase().includes(query);
      shown += row.hidden ? 0 : 1;
    }
    const none = this.querySelector(".table-no-matches");
    if (none) {
      none.hidden = shown > 0;
    }
  }
}

if (!customElements.get("ev-table")) {
  customElements.define("ev-table", TableElement);
}

export { TableElement };
