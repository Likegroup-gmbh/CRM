// UploaderField.js (ES6-Modul)
// Wiederverwendbarer Drag&Drop Uploader für Single- und Multi-Upload

export class UploaderField {
  constructor({ multiple = false, accept = '*/*', maxFileSize = null, onFilesChanged = () => {} } = {}) {
    this.multiple = multiple;
    this.accept = accept;
    this.maxFileSize = maxFileSize; // in Bytes, null = unbegrenzt
    this.onFilesChanged = onFilesChanged;
    this.files = [];
    this.root = null;
    this.input = null;
    this.listEl = null;
    this.errorEl = null;
    this.dropEl = null;
    this.errorMessage = null;
  }

  // Mount in bestehendes Root-Element (das bereits in den DOM eingefügt wurde)
  mount(root) {
    if (!root) return;
    this.root = root;
    const id = `uploader-input-${Math.random().toString(36).slice(2)}`;
    this.root.innerHTML = `
      <div class="uploader-drop" tabindex="0">
        <div class="uploader-instructions">
          <span>Per Drag & Drop hierher ziehen oder</span>
          <button type="button" class="uploader-btn">Datei(en) auswählen</button>
        </div>
        <input type="file" id="${id}" ${this.multiple ? 'multiple' : ''} accept="${this.accept}" style="display:none" />
      </div>
      <div class="uploader-error"></div>
      <div class="uploader-list"></div>
    `;
    this.input = this.root.querySelector('input[type="file"]');
    this.listEl = this.root.querySelector('.uploader-list');
    this.errorEl = this.root.querySelector('.uploader-error');
    this.dropEl = this.root.querySelector('.uploader-drop');
    this.bind();
    // Exponiere Instanz am Root
    this.root.__uploaderInstance = this;
    // Initial leere Liste anzeigen
    this.renderList();
  }

  bind() {
    const drop = this.dropEl;
    const btn = this.root.querySelector('.uploader-btn');
    btn.addEventListener('click', () => this.input.click());
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
      const files = dt.files;
      this.handleFiles(files);
    });
    // Verhindere Browser-Default für Drag&Drop auch auf Formular-Ebene
    const form = this.root.closest('form');
    if (form) {
      ['dragover','drop'].forEach(ev => form.addEventListener(ev, (e) => {
        e.preventDefault();
      }));
    }
  }

  handleFiles(fileList) {
    // Fehler zurücksetzen bei neuem Upload-Versuch
    this.clearError();
    
    if (!fileList || fileList.length === 0) return;
    
    const errors = [];
    const validFiles = [];
    
    for (const file of Array.from(fileList)) {
      // Dateityp prüfen
      if (!this.isAcceptedType(file)) {
        errors.push(`"${file.name}": Dateityp nicht erlaubt`);
        continue;
      }
      
      // Dateigröße prüfen
      if (this.maxFileSize && file.size > this.maxFileSize) {
        errors.push(`"${file.name}": Datei zu groß (max. ${this.formatSize(this.maxFileSize)})`);
        continue;
      }
      
      validFiles.push(file);
    }
    
    // Fehler anzeigen wenn vorhanden
    if (errors.length > 0) {
      this.setError(errors.join(', '));
    }
    
    // Valide Dateien hinzufügen
    if (validFiles.length > 0) {
      if (!this.multiple) {
        this.files = [validFiles[0]];
      } else {
        this.files = [...this.files, ...validFiles];
      }
      this.renderList();
      this.onFilesChanged(this.files);
    }
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

  renderList() {
    if (!this.listEl) return;
    if (!this.files.length) {
      this.listEl.innerHTML = '<div class="uploader-empty">Keine Dateien ausgewählt</div>';
      return;
    }
    const items = this.files.map((f, idx) => `
      <div class="uploader-item">
        <div class="uploader-meta">
          <span class="uploader-name">${f.name}</span>
          <span class="uploader-size">${this.formatSize(f.size)}</span>
        </div>
        <button type="button" class="uploader-remove" data-index="${idx}">Entfernen</button>
      </div>
    `).join('');
    this.listEl.innerHTML = items;
    this.listEl.querySelectorAll('.uploader-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.index, 10);
        this.files.splice(i, 1);
        this.renderList();
        this.onFilesChanged(this.files);
      });
    });
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
