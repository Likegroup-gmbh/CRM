export class UploaderField {
  constructor({ multiple = false, accept = '*/*', maxFileSize = null, onFilesChanged = () => {} } = {}) {
    this.multiple = multiple;
    this.accept = accept;
    this.maxFileSize = maxFileSize;
    this.onFilesChanged = onFilesChanged;
    this.files = [];
    this.existingFiles = [];
    this.deletedFileIds = [];
    this.root = null;
    this.input = null;
    this.listEl = null;
    this.errorEl = null;
    this.dropEl = null;
    this.errorMessage = null;
  }

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
    
    if (errors.length > 0) {
      this.setError(errors.join(', '));
    }
    
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
    
    const keptExisting = this.existingFiles.filter(f => !this.deletedFileIds.includes(f.id));
    
    if (!keptExisting.length && !this.files.length) {
      this.listEl.innerHTML = '<div class="uploader-empty">Keine Dateien ausgewählt</div>';
      return;
    }

    let html = '';

    // Existing files (already uploaded)
    keptExisting.forEach(f => {
      const sizeStr = f.size != null ? this.formatSize(f.size) : '';
      const linkHtml = f.url
        ? `<a href="${f.url}" target="_blank" rel="noopener noreferrer" class="uploader-name uploader-name--link">${this.escapeHtml(f.name)}</a>`
        : `<span class="uploader-name">${this.escapeHtml(f.name)}</span>`;
      html += `
        <div class="uploader-item uploader-item--existing">
          <div class="uploader-meta">
            ${linkHtml}
            ${sizeStr ? `<span class="uploader-size">${sizeStr}</span>` : ''}
            <span class="uploader-badge">Gespeichert</span>
          </div>
          <button type="button" class="uploader-remove" data-existing-id="${f.id}">Entfernen</button>
        </div>
      `;
    });

    // New files (pending upload)
    this.files.forEach((f, idx) => {
      html += `
        <div class="uploader-item">
          <div class="uploader-meta">
            <span class="uploader-name">${f.name}</span>
            <span class="uploader-size">${this.formatSize(f.size)}</span>
            <span class="uploader-badge uploader-badge--new">Neu</span>
          </div>
          <button type="button" class="uploader-remove" data-index="${idx}">Entfernen</button>
        </div>
      `;
    });

    this.listEl.innerHTML = html;
    
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
