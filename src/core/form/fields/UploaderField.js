/**
 * Marker, den automatisch uebernommene Dateien am File-Objekt tragen (z. B. ein
 * von einer Webseite geholtes Logo). Steuert nur die Kennzeichnung in der Liste.
 */
export const EXTRACT_SOURCE_MARKER = '__extractSource';

const TRASH_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.35 9m-4.78 0L9.26 9m9.97-3.21c.34.05.68.1 1.02.16m-1.02-.16L18.16 19.67a2.25 2.25 0 0 1-2.24 2.08H8.08a2.25 2.25 0 0 1-2.24-2.08L4.77 5.79m14.46 0a48 48 0 0 0-3.48-.4m-12 .56c.34-.06.68-.11 1.02-.16m0 0a48 48 0 0 1 3.48-.4v-.91c0-1.18.91-2.16 2.09-2.2a52 52 0 0 1 3.32 0c1.18.04 2.09 1.02 2.09 2.2v.92m-7.5 0a48.7 48.7 0 0 1 7.5 0"/></svg>';

export class UploaderField {
  constructor({
    multiple = false,
    accept = '*/*',
    maxFileSize = null,
    maxFiles = null,
    sortable = false,
    primarySelectable = false,
    variant = 'list',
    onFilesChanged = () => {}
  } = {}) {
    this.multiple = multiple;
    this.accept = accept;
    this.maxFileSize = maxFileSize;
    this.maxFiles = maxFiles;
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
          <th class="col-thumb"></th>
          <th class="col-name">Bild</th>
          ${showPrimary ? '<th class="col-haupt">Hauptbild</th>' : ''}
          ${showSort ? '<th class="col-sort">Reihenfolge</th>' : ''}
          <th class="col-actions"></th>
        </tr>
      </thead>
    `;

    const zeilen = [];

    keptExisting.forEach((f, idx) => {
      const name = f.url
        ? `<a href="${this.escapeHtml(f.url)}" target="_blank" rel="noopener noreferrer" class="table-link">${this.escapeHtml(f.name)}</a>`
        : `<span class="uploader-name">${this.escapeHtml(f.name)}</span>`;

      zeilen.push(this.renderRow({
        thumb: this.renderThumb(this.existingPreviewUrl(f), f.name),
        name,
        primary: showPrimary ? this.renderPrimary(`existing:${f.id}`, true) : null,
        sort: showSort ? this.renderSort('existing', idx, keptExisting.length) : null,
        removeAttr: `data-existing-id="${this.escapeHtml(String(f.id))}"`
      }));
    });

    this.files.forEach((f, idx) => {
      zeilen.push(this.renderRow({
        thumb: this.renderThumb(this.previewUrlFor(f), f.name),
        name: `<span class="uploader-name">${this.escapeHtml(f.name)}</span>
               <span class="uploader-size">${this.formatSize(f.size)}</span>`,
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
  }

  renderRow({ thumb, name, primary, sort, removeAttr }) {
    return `
      <tr>
        <td class="col-thumb">${thumb}</td>
        <td class="col-name">${name}</td>
        ${primary !== null ? `<td class="col-haupt">${primary}</td>` : ''}
        ${sort !== null ? `<td class="col-sort">${sort}</td>` : ''}
        <td class="col-actions">
          <button type="button" class="uploader-remove uploader-remove--icon" ${removeAttr}
                  title="Bild entfernen" aria-label="Bild entfernen">${TRASH_ICON}</button>
        </td>
      </tr>
    `;
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
        <button type="button" class="uploader-move" data-group="${group}" data-index="${index}" data-dir="up" ${index === 0 ? 'disabled' : ''} title="Nach vorne">↑</button>
        <button type="button" class="uploader-move" data-group="${group}" data-index="${index}" data-dir="down" ${index === total - 1 ? 'disabled' : ''} title="Nach hinten">↓</button>
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

  renderThumb(src, name) {
    if (!src) return '';
    return `<img class="uploader-thumb" src="${this.escapeHtml(src)}" alt="${this.escapeHtml(name || '')}" loading="lazy">`;
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
