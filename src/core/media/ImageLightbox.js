import { MediaLightbox } from './MediaLightbox.js';

const EXTERNAL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/**
 * Bild-Viewer auf Basis der MediaLightbox-Shell: ein Bild gross, Prev/Next
 * durch die uebergebene Liste, Escape/Backdrop schliessen.
 *
 * Bewusst duenn gehalten - im Gegensatz zum VideoPlayerLightbox gibt es hier
 * kein Feedback-Panel und keine Dropbox-Anbindung. Die Quellen sind einfache
 * URLs (Supabase public oder blob: aus dem Uploader).
 */
export class ImageLightbox {
  constructor() {
    this.shell = new MediaLightbox();
    this.items = [];
    this.index = 0;
  }

  isOpen() {
    return this.shell.isOpen();
  }

  /**
   * @param {Array<{url: string, name?: string}>} items
   * @param {number} [startIndex]
   */
  open(items, startIndex = 0) {
    this.items = (items || []).filter(item => item && item.url);
    if (!this.items.length) return;

    this.index = Math.min(Math.max(startIndex, 0), this.items.length - 1);
    const mehrere = this.items.length > 1;

    this.shell.open({
      className: 'image-lightbox',
      renderBody: () => this.renderBody(),
      onPrev: mehrere ? () => this.step(-1) : undefined,
      onNext: mehrere ? () => this.step(1) : undefined,
      hasPrev: () => this.index > 0,
      hasNext: () => this.index < this.items.length - 1,
      headerAction: {
        icon: EXTERNAL_ICON,
        ariaLabel: 'In neuem Tab oeffnen',
        // blob:-Quellen aus dem Uploader taugen nicht als dauerhafter Link
        getHref: () => {
          const url = this.current()?.url || '';
          return /^https?:/i.test(url) ? url : null;
        }
      }
    });
  }

  close() {
    return this.shell.close();
  }

  current() {
    return this.items[this.index] || null;
  }

  step(delta) {
    const next = this.index + delta;
    if (next < 0 || next >= this.items.length) return;
    this.index = next;
    this.shell.update();
  }

  renderBody() {
    const item = this.current();
    if (!item) return '';

    const zaehler = this.items.length > 1
      ? `<span class="image-lightbox__counter">${this.index + 1} von ${this.items.length}</span>`
      : '';

    return `
      <figure class="image-lightbox__stage">
        <img class="image-lightbox__img" src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name || '')}">
        <figcaption class="image-lightbox__caption">
          <span class="image-lightbox__name">${escapeHtml(item.name || '')}</span>
          ${zaehler}
        </figcaption>
      </figure>
    `;
  }
}

let geteilteInstanz = null;

/** Eine Instanz fuer die ganze App - zwei offene Lightboxen ergeben keinen Sinn. */
export function openImageLightbox(items, startIndex = 0) {
  if (!geteilteInstanz) geteilteInstanz = new ImageLightbox();
  geteilteInstanz.open(items, startIndex);
  return geteilteInstanz;
}
