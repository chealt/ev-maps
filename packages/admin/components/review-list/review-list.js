import { message } from "@ev-maps/ui/messages.js";

// The script of a server-rendered review page (charger reports,
// suggestions): its status filter shows the page with another ?status=, and
// its cards' .review buttons POST {url}/{id}/{data-action}, then show the
// page again. `element`: the page's custom element; each card has
// data-review-id; `errorMessage`: the message key shown when it fails.
const connectReviewList = (element, { url, errorMessage }) => {
  element.querySelector(".status-filter")?.addEventListener("change", (event) => {
    const pageUrl = new URL(window.location.href);
    pageUrl.searchParams.set("status", event.target.value);
    window.location.assign(pageUrl);
  });
  element.addEventListener("click", async (event) => {
    const button = event.target.closest(".review");
    if (!button) {
      return;
    }
    const { reviewId } = button.closest("[data-review-id]").dataset;
    button.disabled = true;
    try {
      const response = await fetch(`${url}/${reviewId}/${button.dataset.action}`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Review failed: ${response.status}`);
      }
      window.location.reload();
    } catch (error) {
      console.error("Could not review:", error);
      button.disabled = false;
      element.querySelector(".summary").textContent = message(errorMessage);
    }
  });
};

export { connectReviewList };
