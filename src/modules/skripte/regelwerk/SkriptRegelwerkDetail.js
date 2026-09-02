// SkriptRegelwerkDetail.js
// Eine Detailseite fuer DNA und Master: Paper + Autosave, Meta nur bei Neu.

import { renderRegelwerkDokument, bindRegelwerkDokument } from '../../../core/components/RegelwerkDokument.js';
import { adapterFor } from './regelwerkAdapters.js';

export class SkriptRegelwerkDetail {
  constructor() {
    this.adapter = null;
    this.doc = null;
    this.container = null;
    this.handle = null;
    this.metaOptions = null;
  }

  async render(container, kind, childId) {
    await this.cleanup();
    this.container = container;
    this.adapter = adapterFor(kind);
    this.doc = null;

    const istNeu = !childId || childId === 'new';
    if (istNeu) {
      this.metaOptions = await this.adapter.loadMetaOptions();
    } else {
      this.doc = await this.adapter.loadOne(childId);
      if (!this.doc) {
        container.innerHTML = `<div class="empty-state"><p>Dokument nicht gefunden.</p></div>`;
        return;
      }
    }

    this.paint();
    this.bind();
    this.updateChrome();
  }

  paint() {
    const a = this.adapter;
    const istNeu = !this.doc;
    const metaHtml = istNeu ? a.metaFormHtml(this.metaOptions) : '';

    this.container.innerHTML = `
      <div class="regelwerk-page__toolbar" data-rw-toolbar></div>
      ${renderRegelwerkDokument({
        title: this.doc?.name || '',
        inhalt: this.doc?.inhalt || '',
        titlePlaceholder: a.titlePlaceholder,
        bodyPlaceholder: a.bodyPlaceholder,
        metaHtml
      })}
    `;
    this.renderToolbar();
    if (istNeu) a.bindMetaForm(this.container, this.metaOptions || {});
  }

  renderToolbar() {
    const bar = this.container.querySelector('[data-rw-toolbar]');
    if (!bar) return;
    const doc = this.doc;
    if (!doc) {
      bar.innerHTML = `<p class="skripte-hint">Meta wählen, dann schreiben – der erste Save legt den Entwurf an.</p>`;
      return;
    }

    const kannArchivieren = doc.status !== 'archiviert';
    const kannFreigeben = doc.status !== 'aktiv';
    bar.innerHTML = `
      <div class="skripte-detail-meta">${this.adapter.metaBadgesHtml(doc)}</div>
      <div class="regelwerk-page__actions">
        ${kannArchivieren ? '<button type="button" class="mdc-btn mdc-btn--secondary" data-rw-archiv>Archivieren</button>' : ''}
        ${kannFreigeben ? '<button type="button" class="mdc-btn" data-rw-frei>Freigeben &amp; aktivieren</button>' : ''}
      </div>
    `;
    bar.querySelector('[data-rw-archiv]')?.addEventListener('click', () => this.archivieren());
    bar.querySelector('[data-rw-frei]')?.addEventListener('click', () => this.freigeben());
  }

  bind() {
    const root = this.container.querySelector('#regelwerk-dokument');
    this.handle = bindRegelwerkDokument(root, {
      onSave: (feld, text) => this.persist(feld, text)
    });
  }

  readFelder() {
    return {
      name: this.handle?.readFeld('name') ?? '',
      inhalt: this.handle?.readFeld('inhalt') ?? ''
    };
  }

  async persist(feld, text) {
    try {
      if (!this.doc) {
        const meta = this.adapter.readMeta(this.container);
        if (!this.adapter.metaGueltig(meta)) {
          throw new Error(this.adapter.metaFehler());
        }
        const felder = this.readFelder();
        this.doc = await this.adapter.create({ ...meta, ...felder, [feld]: text });
        const path = `${this.adapter.listPath}/${this.doc.id}`;
        window.history.replaceState({ route: path }, '', path);
        this.renderToolbar();
        this.updateChrome();
        return;
      }
      await this.adapter.update(this.doc.id, { [feld]: text });
      this.doc = { ...this.doc, [feld]: text };
      if (feld === 'name') this.updateChrome();
    } catch (err) {
      window.toastSystem?.error(err.message);
      throw err;
    }
  }

  async archivieren() {
    if (!this.doc) return;
    try {
      await this.handle?.inlineEdit.flush();
      await this.adapter.archive(this.doc.id);
      this.doc = { ...this.doc, status: 'archiviert' };
      this.renderToolbar();
      window.toastSystem?.success('Archiviert');
    } catch (err) {
      window.toastSystem?.error(err.message);
    }
  }

  async freigeben() {
    if (!this.doc) return;
    try {
      await this.handle?.inlineEdit.flush();
      const felder = this.readFelder();
      await this.adapter.update(this.doc.id, felder);
      await this.adapter.activate({ ...this.doc, ...felder });
      this.doc = { ...this.doc, ...felder, status: 'aktiv' };
      this.renderToolbar();
      window.toastSystem?.success(`${this.adapter.label} v${this.doc.version} ist jetzt aktiv`);
    } catch (err) {
      window.toastSystem?.error(err.message);
    }
  }

  updateChrome() {
    const a = this.adapter;
    window.setHeadline(a.headline);
    const childId = this.doc?.id || 'new';
    window.breadcrumbSystem?.setFromRoute('skripte', a.kind, { action: childId });
    if (this.doc) {
      window.breadcrumbSystem?.updateDetailLabel(a.titleOf(this.doc));
    }
  }

  async cleanup() {
    try { await this.handle?.destroy(); } catch (_) { /* Unmount trotzdem */ }
    this.handle = null;
    this.container = null;
    this.doc = null;
    this.adapter = null;
    this.metaOptions = null;
  }
}
