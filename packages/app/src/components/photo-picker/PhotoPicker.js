import { scaledPhoto } from "../../lib/photos.js";

class PhotoPickerElement extends HTMLElement {
  photos = [];

  connectedCallback() {
    this.max = Number(this.dataset.max) || 3;
    this.input = this.querySelector(".photo-input");
    this.grid = this.querySelector(".photo-grid");
    this.input.addEventListener("change", () => this.add([...(this.input.files ?? [])]));
  }

  // Whether the file picker has the focus (Esc then closes it, not the
  // dialog the picker is in).
  get choosing() {
    return this.input.matches(":focus");
  }

  reset() {
    this.photos = [];
    this.render();
  }

  async add(files) {
    for (const file of files) {
      if (this.photos.length >= this.max) {
        this.dispatchEvent(new CustomEvent("photo-limit", { bubbles: true }));
        break;
      }
      try {
        this.photos.push(await scaledPhoto(file));
      } catch {
        this.dispatchEvent(new CustomEvent("photo-unreadable", { bubbles: true }));
      }
    }
    this.input.value = "";
    this.render();
  }

  render() {
    this.grid.hidden = this.photos.length === 0;
    const template = this.querySelector(".photo-item-template");
    this.grid.replaceChildren(
      ...this.photos.map((url, index) => {
        const item = template.content.firstElementChild.cloneNode(true);
        item.querySelector(".photo-thumb").src = url;
        item.querySelector(".remove-photo").addEventListener("click", () => {
          this.photos.splice(index, 1);
          this.render();
        });
        return item;
      })
    );
    this.dispatchEvent(new CustomEvent("photos-change", { bubbles: true }));
  }
}

customElements.define("ev-photo-picker", PhotoPickerElement);

export { PhotoPickerElement };
