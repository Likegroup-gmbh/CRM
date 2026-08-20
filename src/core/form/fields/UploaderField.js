import { compressImage } from '../../ImageCompressor.js';
import { openImageLightbox } from '../../media/ImageLightbox.js';
import { icon } from '../../../core/icons/IconSystem.js';

/**
 * Marker, den automatisch uebernommene Dateien am File-Objekt tragen (z. B. ein
 * von einer Webseite geholtes Logo). Steuert nur die Kennzeichnung in der Liste.
 */
export const EXTRACT_SOURCE_MARKER = '__extractSource';

const TRASH_ICON = icon('trash-alt');

// Zeigt nach unten; die Aufwaerts-Variante entsteht per Drehung im CSS.
// Ohne width/height, damit die Groesse aus var(--icon-xs) kommt.
const CARET_ICON = icon('chevron-down-bold');

/**
 * Voreinstellung fuers manuelle Verkleinern, siehe Option shrinkOptions.
 * AVIF spart am meisten; wo der Browser es nicht encodieren kann, greift WebP.
 */
const SHRINK_DEFAULTS = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.7,
  format: 'image/avif',
  fallbackFormat: 'image/webp'
};

export class UploaderField {
  constructor({
    multiple = false,
    accept = '*/*',
    maxFileSize = null,
    maxFiles = null,
    warnFileSize = null,
    shrinkOptions = null,
    sortable = false,
    primarySelectable = false,
    variant = 'list',
    onFilesChanged = () => {}
  } = {}) {
    this.multiple = multiple;
    this.accept = accept;
    this.maxFileSize = maxFileSize;
    this.maxFiles = maxFiles;
    // Ab dieser Groesse bekommt die Zeile einen Warn-Badge und den
    // Reduzieren-Button. null blendet Badge und Button komplett aus.
    this.warnFileSize = warnFileSize;
    this.shrinkOptions = { ...SHRINK_DEFAULTS, ...(shrinkOptions || {}) };
    // 'table' rendert die Dateien im CRM-Tabellenlook statt als Karten-Liste
    this.variant = variant;
    // Sortierung und Hauptbild-Auswahl brauchen nur Galerien (z.B. Produktbilder)
    this.sortable = sortable;
    this.primarySelectable = primarySelectable;
    this.onFilesChanged = onFilesChanged;
    this.files = [];
    this.existingFiles = [];
    this.deletedFileIds = [];
    // "existing:{id}" oder "new:{index}" - null bedeutet: erstes Bild ist Hauptbild
    this.primaryKey = null;
    this.root = null;
    this.input = null;
    this.listEl = null;
    this.errorEl = null;
    this.dropEl = null;
    this.errorMessage = null;
    // Blob-URLs der Thumbnails, werden bei jedem Rendern neu erzeugt
    this.objectUrls = [];
    // Masse und Bytes je Datei. Key ist das File-Objekt bzw. "e:{id}" - beides
    // ueberlebt Sortieren und Neu-Rendern, ein Index waere dafuer zu wackelig.
    this.meta = new Map();
    // Bilder der aktuellen Tabelle in Anzeigereihenfolge, Quelle der Lightbox
    this.previewItems = [];
  }

  mount(root) {
    if (!root) return;
    this.root = root;
    const id = `uploader-input-${Math.random().toString(36).slice(2)}`;
    const drop = `
      <div class="uploader-drop" tabindex="0">
        <div class="uploader-instructions">
          <span>Per Drag & Drop hierher ziehen oder</span>
          <button type="button" class="uploader-btn">Datei(en) auswählen</button>
        </div>
        <input type="file" id="${id}" ${this.multiple ? 'multiple' : ''} accept="${this.accept}" style="display:none" />
      </div>
    `;
    const liste = '<div class="uploader-list"></div>';
    const fehler = '<div class="uploader-error"></div>';

    // In der Tabellenansicht steht die Tabelle oben und die Ablagefläche
    // darunter, damit die vorhandenen Bilder nicht nach unten wandern.
    this.root.innerHTML = this.variant === 'table'
      ? `${liste}${fehler}${drop}`
      : `${drop}${fehler}${liste}`;
    this.input = this.root.querySelector('input[type="file"]');
    this.listEl = this.root.querySelector('.uploader-list');
    this.errorEl = this.root.querySelector('.uploader-error');
    this.dropEl = this.root.querySelector('.uploader-drop');
    this.bind();
    this.bindDelegated();
    this.root.__uploaderInstance = this;
    this.renderList();
  }

  bind() {
    const drop = this.dropEl;
    
    drop.addEventListener('click', (e) => {
      if (e.target.closest('.uploader-remove')) return;
      this.input.click();
    });
    
    this.input.addEventListener('change', (e) => this.handleFiles(e.target.files));

    ;['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('is-dragover');
    }));
    ;['dragleave','dragend','drop'].forEach(ev => drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove('is-dragover');
    }));
    drop.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (!dt) return;
      this.handleFiles(dt.files);
    });
    const form = this.root.closest('form');
    if (form) {
      ['dragover','drop'].forEach(ev => form.addEventListener(ev, (e) => {
        e.preventDefault();
      }));
    }
  }

  handleFiles(fileList) {
    this.clearError();
    if (!fileList || fileList.length === 0) return;
    
    const errors = [];
    const validFiles = [];
    
    for (const file of Array.from(fileList)) {
      if (!this.isAcceptedType(file)) {
        errors.push(`"${file.name}": Dateityp nicht erlaubt`);
        continue;
      }
      if (this.maxFileSize && file.size > this.maxFileSize) {
        errors.push(`"${file.name}": Datei zu groß (max. ${this.formatSize(this.maxFileSize)})`);
        continue;
      }
      validFiles.push(file);
    }
    
    if (validFiles.length > 0) {
      if (!this.multiple) {
        this.files = [validFiles[0]];
      } else {
        const frei = this.maxFiles ? Math.max(0, this.maxFiles - this.totalCount()) : validFiles.length;
        if (validFiles.length > frei) {
          errors.push(`Maximal ${this.maxFiles} Dateien – ${validFiles.length - frei} wurden nicht übernommen`);
        }
        this.files = [...this.files, ...validFiles.slice(0, frei)];
      }
      this.renderList();
      this.onFilesChanged(this.files);
    }

    if (errors.length > 0) {
      this.setError(errors.join(', '));
    }
  }

  /** Bestehende (nicht geloeschte) plus neue Dateien. */
  totalCount() {
    return this.getKeptExistingFiles().length + this.files.length;
  }

  isAcceptedType(file) {
    if (!this.accept || this.accept === '*/*') return true;
    const types = this.accept.split(',').map(s => s.trim());
    return types.some(t => {
      if (t.endsWith('/*')) {
        return file.type.startsWith(t.slice(0, -1));
      }
      return file.type === t || (`.${file.name.split('.').pop()}` === t);
    });
  }

  setError(message) {
    this.errorMessage = message;
    if (this.errorEl) {
      this.errorEl.textContent = message;
      this.errorEl.style.display = 'block';
    }
    if (this.dropEl) {
      this.dropEl.classList.add('has-error');
    }
  }

  clearError() {
    this.errorMessage = null;
    if (this.errorEl) {
      this.errorEl.textContent = '';
      this.errorEl.style.display = 'none';
    }
    if (this.dropEl) {
      this.dropEl.classList.remove('has-error');
    }
  }

  // --- Existing Files Support (Edit-Mode) ---

  setExistingFiles(files) {
    this.existingFiles = files || [];
    this.deletedFileIds = [];
    this.renderList();
  }

  getDeletedFileIds() {
    return [...this.deletedFileIds];
  }

  getKeptExistingFiles() {
    return this.existingFiles.filter(f => !this.deletedFileIds.includes(f.id));
  }

  removeExistingFile(fileId) {
    if (!this.deletedFileIds.includes(fileId)) {
      this.deletedFileIds.push(fileId);
    }
    this.renderList();
    this.onFilesChanged(this.files);
  }

  // --- Render ---

  renderList() {
    if (!this.listEl) return;

    this.releaseObjectUrls();
    this.previewItems = [];

    const keptExisting = this.existingFiles.filter(f => !this.deletedFileIds.includes(f.id));

    if (!keptExisting.length && !this.files.length) {
      this.listEl.innerHTML = this.variant === 'table'
        ? ''
        : '<div class="uploader-empty">Keine Dateien ausgewählt</div>';
      return;
    }

    if (this.variant === 'table') {
      this.renderTable(keptExisting);
      return;
    }

    let html = '';

    // Existing files (already uploaded)
    keptExisting.forEach((f, idx) => {
      const sizeStr = f.size != null ? this.formatSize(f.size) : '';
      const linkHtml = f.url
        ? `<a href="${f.url}" target="_blank" rel="noopener noreferrer" class="uploader-name uploader-name--link">${this.escapeHtml(f.name)}</a>`
        : `<span class="uploader-name">${this.escapeHtml(f.name)}</span>`;
      const badge = f.isTemporary
        ? '<span class="uploader-badge uploader-badge--extracted">Von der Webseite</span>'
        : '<span class="uploader-badge">Gespeichert</span>';
      html += `
        <div class="uploader-item uploader-item--existing">
          ${this.renderThumb(this.existingPreviewUrl(f), f.name)}
          <div class="uploader-meta">
            ${linkHtml}
            ${sizeStr ? `<span class="uploader-size">${sizeStr}</span>` : ''}
            ${badge}
            ${this.renderPrimary(`existing:${f.id}`)}
          </div>
          ${this.renderSort('existing', idx, keptExisting.length)}
          <button type="button" class="uploader-remove" data-existing-id="${f.id}">Entfernen</button>
        </div>
      `;
    });

    // New files (pending upload)
    this.files.forEach((f, idx) => {
      const fromExtraction = Boolean(f[EXTRACT_SOURCE_MARKER]);
      const badge = fromExtraction
        ? '<span class="uploader-badge uploader-badge--extracted">Von der Webseite</span>'
        : '<span class="uploader-badge uploader-badge--new">Neu</span>';
      const hint = fromExtraction
        ? '<span class="uploader-hint">Wird beim Anlegen gespeichert</span>'
        : '';

      html += `
        <div class="uploader-item">
          ${this.renderThumb(this.previewUrlFor(f), f.name)}
          <div class="uploader-meta">
            <span class="uploader-name">${this.escapeHtml(f.name)}</span>
            <span class="uploader-size">${this.formatSize(f.size)}</span>
            ${badge}
            ${hint}
            ${this.renderPrimary(`new:${idx}`)}
          </div>
          ${this.renderSort('new', idx, this.files.length)}
          <button type="button" class="uploader-remove" data-index="${idx}">Entfernen</button>
        </div>
      `;
    });

    this.listEl.innerHTML = html;
    this.bindRemove();
    this.bindSortAndPrimary(keptExisting);
  }

  /**
   * Tabellenansicht im CRM-Look. Nutzt dieselben Buttons und Radios wie die
   * Listenansicht, damit bindRemove() und bindSortAndPrimary() unverändert
   * greifen - nur die Huelle ist eine Tabelle.
   */
  renderTable(keptExisting) {
    const total = keptExisting.length + this.files.length;
    const showSort = this.sortable && total > 1;
    const showPrimary = this.primarySelectable;

    const kopf = `
      <thead>
        <tr>
          <th class="col-thumb">Bild</th>
          <th class="col-name">Bezeichnung</th>
          <th class="col-dimension">Maße</th>
          <th class="col-size">Größe</th>
          ${showPrimary ? '<th class="col-haupt">Hauptbild</th>' : ''}
          ${showSort ? '<th class="col-sort">Reihenfolge</th>' : ''}
          <th class="col-actions">Löschen</th>
        </tr>
      </thead>
    `;

    // Reihenfolge der Lightbox-Eintraege = Reihenfolge der Zeilen
    const zeilen = [];

    keptExisting.forEach((f, idx) => {
      const previewUrl = this.existingPreviewUrl(f);
      const previewIndex = this.registerPreview(previewUrl, f.name);
      const name = previewIndex !== null
        ? `<button type="button" class="uploader-name-btn table-link" data-preview-index="${previewIndex}">${this.escapeHtml(f.name)}</button>`
        : `<span class="uploader-name">${this.escapeHtml(f.name)}</span>`;

      zeilen.push(this.renderRow({
        rowKey: `existing:${f.id}`,
        thumb: this.renderThumb(previewUrl, f.name, previewIndex),
        name,
        meta: this.metaCells(f, `existing:${f.id}`),
        primary: showPrimary ? this.renderPrimary(`existing:${f.id}`, true) : null,
        sort: showSort ? this.renderSort('existing', idx, keptExisting.length) : null,
        removeAttr: `data-existing-id="${this.escapeHtml(String(f.id))}"`
      }));
    });

    this.files.forEach((f, idx) => {
      const previewUrl = this.previewUrlFor(f);
      const previewIndex = this.registerPreview(previewUrl, f.name);

      zeilen.push(this.renderRow({
        rowKey: `new:${idx}`,
        thumb: this.renderThumb(previewUrl, f.name, previewIndex),
        name: previewIndex !== null
          ? `<button type="button" class="uploader-name-btn table-link" data-preview-index="${previewIndex}">${this.escapeHtml(f.name)}</button>`
          : `<span class="uploader-name">${this.escapeHtml(f.name)}</span>`,
        meta: this.metaCells(f, `new:${idx}`),
        primary: showPrimary ? this.renderPrimary(`new:${idx}`, true) : null,
        sort: showSort ? this.renderSort('new', idx, this.files.length) : null,
        removeAttr: `data-index="${idx}"`
      }));
    });

    this.listEl.innerHTML = `
      <div class="table-container uploader-table-container">
        <table class="data-table data-table--uploader">
          ${kopf}
          <tbody>${zeilen.join('')}</tbody>
        </table>
      </div>
    `;

    this.bindRemove();
    this.bindSortAndPrimary(keptExisting);
    this.resolvePendingMeta(keptExisting);
  }

  renderRow({ rowKey, thumb, name, meta, primary, sort, removeAttr }) {
    return `
      <tr data-row-key="${this.escapeHtml(rowKey || '')}">
        <td class="col-thumb">${thumb}</td>
        <td class="col-name">${name}</td>
        <td class="col-dimension">${meta.dimension}</td>
        <td class="col-size">${meta.size}</td>
        ${primary !== null ? `<td class="col-haupt">${primary}</td>` : ''}
        ${sort !== null ? `<td class="col-sort">${sort}</td>` : ''}
        <td class="col-actions">
          <button type="button" class="uploader-remove uploader-remove--icon" ${removeAttr}
                  title="Bild entfernen" aria-label="Bild entfernen">${TRASH_ICON}</button>
        </td>
      </tr>
    `;
  }

  // --- Masse, Dateigroesse, Vorschau ---

  /**
   * Nimmt ein Bild in die Lightbox-Liste auf und liefert seinen Index.
   * null bedeutet: keine anzeigbare Vorschau (z.B. PDF im Dokumenten-Uploader).
   */
  registerPreview(url, name) {
    if (!url) return null;
    this.previewItems.push({ url, name: name || '' });
    return this.previewItems.length - 1;
  }

  /**
   * Cache-Schluessel je Datei. Bestehende Bilder haengen an ihrer ID, neue am
   * File-Objekt selbst - so ueberlebt der Cache Sortieren und Neu-Rendern.
   */
  metaKey(entry) {
    return entry && entry.id !== undefined ? `e:${entry.id}` : entry;
  }

  /** Die Datei, aus der Masse und Groesse zu lesen sind - inklusive Ersatz. */
  fileFor(entry) {
    if (!entry) return null;
    if (entry.replacementFile) return entry.replacementFile;
    return entry.id !== undefined ? null : entry;
  }

  metaCells(entry, rowKey) {
    const info = this.meta.get(this.metaKey(entry));

    if (!info || info.status === 'loading') {
      const pending = '<span class="uploader-meta-pending">…</span>';
      return { dimension: pending, size: pending };
    }

    const dimension = info.width && info.height
      ? `<span class="uploader-dimension">${info.width}×${info.height}</span>`
      : '–';

    return { dimension, size: this.sizeCell(info, entry, rowKey) };
  }

  sizeCell(info, entry, rowKey) {
    if (info.bytes == null) return '–';

    const zuGross = this.warnFileSize != null && info.bytes > this.warnFileSize;
    const teile = [
      `<span class="uploader-size${zuGross ? ' uploader-size--warn' : ''}">${this.formatSize(info.bytes)}</span>`
    ];

    if (zuGross) {
      teile.push('<span class="uploader-badge uploader-badge--warn">Große Datei</span>');
      teile.push(`<button type="button" class="uploader-shrink" data-shrink-key="${this.escapeHtml(rowKey || '')}">Reduzieren</button>`);
    }
    if (entry?.replacementFile) {
      teile.push('<span class="uploader-hint">wird beim Speichern ersetzt</span>');
    }

    return `<div class="uploader-size-cell">${teile.join('')}</div>`;
  }

  /** Stoesst das Nachladen fuer alle Zeilen ohne Cache-Eintrag an. */
  resolvePendingMeta(keptExisting) {
    [...keptExisting, ...this.files].forEach(entry => {
      if (this.meta.has(this.metaKey(entry))) return;
      this.loadMeta(entry);
    });
  }

  /**
   * Masse und Bytes ermitteln. Bei neuen Dateien liegt beides lokal vor, bei
   * gespeicherten kommt die Groesse per HEAD (content-length ist CORS-safe)
   * und die Masse aus einem Image-Objekt, das denselben HTTP-Cache nutzt wie
   * das Thumbnail - also ohne zweiten Download.
   */
  async loadMeta(entry) {
    const key = this.metaKey(entry);
    this.meta.set(key, { status: 'loading' });

    const info = { status: 'ready', width: null, height: null, bytes: null };
    const file = this.fileFor(entry);

    try {
      if (file) {
        info.bytes = file.size;
        const masse = await this.readDimensionsFromFile(file);
        Object.assign(info, masse);
      } else {
        const url = this.existingPreviewUrl(entry);
        if (url) {
          const [bytes, masse] = await Promise.all([
            this.readContentLength(url),
            this.readDimensionsFromUrl(url)
          ]);
          info.bytes = bytes;
          Object.assign(info, masse);
        }
      }
    } catch (err) {
      console.warn('⚠️ Bildinfos konnten nicht gelesen werden:', err);
    }

    this.meta.set(key, info);
    this.refreshMetaCells();
  }

  async readDimensionsFromFile(file) {
    if (!file.type?.startsWith('image/') || typeof createImageBitmap !== 'function') return {};
    const bitmap = await createImageBitmap(file);
    const masse = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return masse;
  }

  readDimensionsFromUrl(url) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({});
      img.src = url;
    });
  }

  async readContentLength(url) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      const laenge = res.headers.get('content-length');
      return laenge ? Number(laenge) : null;
    } catch {
      return null;
    }
  }

  /**
   * Schreibt die beiden Meta-Spalten neu, ohne die Tabelle zu ersetzen - ein
   * voller Re-Render wuerde die Blob-URLs der Thumbnails verwerfen.
   */
  refreshMetaCells() {
    if (!this.listEl) return;

    const zeilen = [
      ...this.getKeptExistingFiles().map(f => [`existing:${f.id}`, f]),
      ...this.files.map((f, i) => [`new:${i}`, f])
    ];

    const vorhandene = [...this.listEl.querySelectorAll('tr[data-row-key]')];
    zeilen.forEach(([rowKey, entry]) => {
      const tr = vorhandene.find(el => el.dataset.rowKey === rowKey);
      if (!tr) return;
      const zellen = this.metaCells(entry, rowKey);
      const dim = tr.querySelector('.col-dimension');
      const size = tr.querySelector('.col-size');
      if (dim) dim.innerHTML = zellen.dimension;
      if (size) size.innerHTML = zellen.size;
    });
  }

  /**
   * Vorschau und Reduzieren laufen ueber Delegation, weil beide Buttons auch
   * nachtraeglich in die Tabelle wandern (refreshMetaCells).
   */
  bindDelegated() {
    this.listEl.addEventListener('click', (e) => {
      const preview = e.target.closest('[data-preview-index]');
      if (preview) {
        e.preventDefault();
        e.stopPropagation();
        openImageLightbox(this.previewItems, Number(preview.dataset.previewIndex));
        return;
      }

      const shrink = e.target.closest('.uploader-shrink');
      if (shrink) {
        e.preventDefault();
        e.stopPropagation();
        this.shrinkRow(shrink.dataset.shrinkKey, shrink);
      }
    });
  }

  /** Verkleinert eine Datei aus der Tabelle. rowKey ist "existing:{id}" oder "new:{index}". */
  async shrinkRow(rowKey, btn) {
    const [gruppe, rest] = String(rowKey || '').split(/:(.*)/);
    const entry = gruppe === 'new'
      ? this.files[Number(rest)]
      : this.getKeptExistingFiles().find(f => String(f.id) === rest);
    if (!entry) return;

    btn.disabled = true;
    btn.textContent = 'Reduziere…';
    this.clearError();

    try {
      const original = this.fileFor(entry) || await this.fetchAsFile(entry);
      const kleiner = await compressImage(original, this.shrinkOptions);

      if (kleiner.size >= original.size) {
        this.setError(`"${original.name}": lässt sich nicht weiter verkleinern`);
        btn.disabled = false;
        btn.textContent = 'Reduzieren';
        return;
      }

      if (gruppe === 'new') {
        this.files[Number(rest)] = kleiner;
      } else {
        entry.replacementFile = kleiner;
      }

      this.meta.delete(this.metaKey(entry));
      this.renderList();
      this.onFilesChanged(this.files);
    } catch (err) {
      console.warn('⚠️ Bild konnte nicht verkleinert werden:', err);
      this.setError('Bild konnte nicht verkleinert werden');
      btn.disabled = false;
      btn.textContent = 'Reduzieren';
    }
  }

  /** Laedt ein gespeichertes Bild zurueck, damit es neu komprimiert werden kann. */
  async fetchAsFile(entry) {
    const res = await fetch(entry.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return new File([blob], entry.name || 'bild', { type: blob.type || 'image/*' });
  }

  bindRemove() {
    this.listEl.querySelectorAll('.uploader-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const existingId = btn.dataset.existingId;
        if (existingId) {
          this.removeExistingFile(existingId);
        } else {
          const i = parseInt(btn.dataset.index, 10);
          this.files.splice(i, 1);
          this.renderList();
          this.onFilesChanged(this.files);
        }
      });
    });
  }

  // --- Sortierung und Hauptbild (nur wenn aktiviert) ---

  renderSort(group, index, total) {
    if (!this.sortable || total < 2) return '';
    return `
      <div class="uploader-sort">
        <button type="button" class="uploader-move" data-group="${group}" data-index="${index}" data-dir="up" ${index === 0 ? 'disabled' : ''} title="Nach vorne" aria-label="Nach vorne">${CARET_ICON}</button>
        <button type="button" class="uploader-move" data-group="${group}" data-index="${index}" data-dir="down" ${index === total - 1 ? 'disabled' : ''} title="Nach hinten" aria-label="Nach hinten">${CARET_ICON}</button>
      </div>
    `;
  }

  /**
   * @param {string} key
   * @param {boolean} compact - in der Tabelle steht "Hauptbild" schon im
   *        Spaltenkopf, dort reicht das Radio ohne Beschriftung
   */
  renderPrimary(key, compact = false) {
    if (!this.primarySelectable) return '';
    const checked = this.effectivePrimaryKey() === key ? 'checked' : '';
    const label = compact ? '' : '<span>Hauptbild</span>';
    const cls = compact ? 'uploader-primary uploader-primary--compact' : 'uploader-primary';
    return `
      <label class="${cls}"${compact ? ' title="Als Hauptbild verwenden"' : ''}>
        <input type="radio" class="uploader-primary-radio" data-primary-key="${key}" ${checked}>
        ${label}
      </label>
    `;
  }

  /** Ohne explizite Wahl gilt das erste Bild als Hauptbild. */
  effectivePrimaryKey() {
    if (this.primaryKey) return this.primaryKey;
    const first = this.getKeptExistingFiles()[0];
    if (first) return `existing:${first.id}`;
    return this.files.length ? 'new:0' : null;
  }

  bindSortAndPrimary(keptExisting) {
    this.listEl.querySelectorAll('.uploader-move').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index, 10);
        const ziel = btn.dataset.dir === 'up' ? index - 1 : index + 1;

        if (btn.dataset.group === 'new') {
          if (ziel < 0 || ziel >= this.files.length) return;
          const [moved] = this.files.splice(index, 1);
          this.files.splice(ziel, 0, moved);
        } else {
          if (ziel < 0 || ziel >= keptExisting.length) return;
          const [moved] = keptExisting.splice(index, 1);
          keptExisting.splice(ziel, 0, moved);
          // geloeschte Eintraege bleiben erhalten, damit sie nicht wieder auftauchen
          const geloescht = this.existingFiles.filter(f => this.deletedFileIds.includes(f.id));
          this.existingFiles = [...keptExisting, ...geloescht];
        }

        this.renderList();
        this.onFilesChanged(this.files);
      });
    });

    this.listEl.querySelectorAll('.uploader-primary-radio').forEach(radio => {
      radio.addEventListener('change', (e) => {
        e.stopPropagation();
        this.primaryKey = radio.dataset.primaryKey;
        this.renderList();
      });
    });

    // Klick auf die Labels darf nicht den Datei-Dialog oeffnen
    this.listEl.querySelectorAll('.uploader-primary, .uploader-sort').forEach(el => {
      el.addEventListener('click', (e) => e.stopPropagation());
    });
  }

  // --- Thumbnails ---

  /** Mit previewIndex wird das Thumbnail zum Ausloeser der Lightbox. */
  renderThumb(src, name, previewIndex = null) {
    if (!src) return '';
    const img = `<img class="uploader-thumb" src="${this.escapeHtml(src)}" alt="${this.escapeHtml(name || '')}" loading="lazy">`;
    if (previewIndex === null) return img;
    return `<button type="button" class="uploader-thumb-btn" data-preview-index="${previewIndex}"
                    title="Vorschau öffnen" aria-label="Vorschau öffnen">${img}</button>`;
  }

  /** Blob-URL fuer Bilddateien; alles andere bekommt kein Thumbnail. */
  previewUrlFor(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) return null;
    const url = URL.createObjectURL(file);
    this.objectUrls.push(url);
    return url;
  }

  /**
   * Bereits gespeicherte Dateien haben nur Name und URL, keinen MIME-Type -
   * daher Entscheidung ueber die Endung. Verhindert kaputte Thumbnails bei
   * Dokumenten-Uploadern (Vertraege, Rechnungen).
   */
  existingPreviewUrl(file) {
    if (!file?.url) return null;
    const name = `${file.name || ''} ${file.url}`;
    return /\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/i.test(name) ? file.url : null;
  }

  releaseObjectUrls() {
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
    this.objectUrls = [];
  }

  destroy() {
    this.releaseObjectUrls();
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  formatSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let i = 0;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return `${size.toFixed(1)} ${units[i]}`;
  }
}
