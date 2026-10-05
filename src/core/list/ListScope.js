// ListScope.js
// DOM-Scoping einer Liste: Standard ist das Dokument, eingebettet (Embedded-Mount,
// z.B. Produktions-Tab) ist es ein fremdes Root-Element.

export class ListScope {
  /**
   * @param {() => (HTMLElement|null)} getMountRoot - liefert das aktuelle Mount-Root
   *   (die Liste hält mountRoot als öffentliches Feld, Unterklassen setzen es direkt)
   */
  constructor(getMountRoot) {
    this._getMountRoot = getMountRoot;
  }

  byId(id) {
    if (!id) return null;
    const root = this._getMountRoot();
    if (!root) return document.getElementById(id);
    return root.querySelector(`#${id}`);
  }

  query(selector) {
    return (this._getMountRoot() || document).querySelector(selector);
  }

  queryAll(selector) {
    return (this._getMountRoot() || document).querySelectorAll(selector);
  }

  eventRoot() {
    return this._getMountRoot() || document;
  }

  contentTarget() {
    const root = this._getMountRoot();
    if (root) return root;
    return window.content || document.getElementById('dashboard-content');
  }

  writeContent(html) {
    const content = this.contentTarget();
    if (!content) return;
    if (this._getMountRoot() || typeof window.setContentSafely !== 'function') {
      content.innerHTML = html;
      return;
    }
    window.setContentSafely(content, html);
  }
}
