// RechnungDetail.js (ES6-Modul)

export class RechnungDetail {
  constructor() {
    this.id = null;
    this.data = null;
    this.belege = [];
  }

  async init(id) {
    this.id = id;
    if (id === 'new') {
      return this.showCreateForm();
    }
    await this.load();
    this.render();
    this.bindEvents();
  }

  async load() {
    const { data, error } = await window.supabase
      .from('rechnung')
      .select(`*,
        unternehmen:unternehmen_id(id, firmenname),
        auftrag:auftrag_id(id, auftragsname)
      `)
      .eq('id', this.id)
      .single();
    if (error) throw error;
    this.data = data;

    // Belege zu dieser Rechnung laden und signierte URLs generieren
    try {
      const { data: belegeRows } = await window.supabase
        .from('rechnung_belege')
        .select('id, file_name, file_path, file_url, content_type, size, uploaded_at, uploaded_by')
        .eq('rechnung_id', this.id)
        .order('uploaded_at', { ascending: false });
      const bucket = 'rechnung-belege';
      const processed = [];
      for (const row of (belegeRows || [])) {
        let openUrl = row.file_url || '';
        try {
          const { data: signed } = await window.supabase.storage
            .from(bucket)
            .createSignedUrl(row.file_path, 60 * 60);
          if (signed?.signedUrl) openUrl = signed.signedUrl;
        } catch (_) {}
        processed.push({ ...row, open_url: openUrl });
      }
      this.belege = processed;
    } catch (_) {
      this.belege = [];
    }
  }

  render() {
    window.setHeadline(`Rechnung ${this.data?.rechnung_nr || ''}`);
    const formatCurrency = (v) => v == null ? '-' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
    const formatDate = (v) => v ? new Intl.DateTimeFormat('de-DE').format(new Date(v)) : '-';

    const html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Rechnung ${this.data?.rechnung_nr || ''}</h1>
          <p>Details zur Rechnung</p>
        </div>
        <div class="page-header-right">
          <button id="btn-edit-rechnung" class="secondary-btn">Bearbeiten</button>
          <button onclick="window.navigateTo('/rechnung')" class="secondary-btn">Zur Übersicht</button>
        </div>
      </div>

      <div class="content-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Allgemein</h3>
            <div class="detail-item"><label>Rechnungs-Nr</label><span>${this.data?.rechnung_nr || '-'}</span></div>
            <div class="detail-item"><label>Unternehmen</label><span>${this.data?.unternehmen?.firmenname || '-'}</span></div>
            <div class="detail-item"><label>Auftrag</label><span>${this.data?.auftrag?.auftragsname || '-'}</span></div>
            <div class="detail-item"><label>Status</label><span>${this.data?.status || '-'}</span></div>
            <div class="detail-item"><label>Gestellt am</label><span>${formatDate(this.data?.gestellt_am)}</span></div>
            <div class="detail-item"><label>Zahlungsziel</label><span>${formatDate(this.data?.zahlungsziel)}</span></div>
            <div class="detail-item"><label>Bezahlt am</label><span>${formatDate(this.data?.bezahlt_am)}</span></div>
            <div class="detail-item"><label>Nettobetrag</label><span>${formatCurrency(this.data?.betrag_netto)}</span></div>
            <div class="detail-item"><label>Bruttobetrag</label><span>${formatCurrency(this.data?.betrag_brutto)}</span></div>
            <div class="detail-item"><label>PDF</label><span>${this.data?.pdf_url ? `<a href="${this.data.pdf_url}" target="_blank" rel="noopener noreferrer">Öffnen</a>` : '-'}</span></div>
          </div>

          <div class="detail-card">
            <h3>Belege</h3>
            ${(!this.belege || this.belege.length === 0) ? `
              <p class="empty-state">Keine Belege vorhanden</p>
            ` : `
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Datei</th>
                      <th>Größe</th>
                      <th>Hochgeladen am</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.belege.map(b => `
                      <tr>
                        <td>${window.validatorSystem.sanitizeHtml(b.file_name || '')}</td>
                        <td>${b.size != null ? (Math.round((b.size/1024)*10)/10)+' KB' : '-'}</td>
                        <td>${formatDate(b.uploaded_at)}</td>
                        <td>${b.open_url ? `<a href="${b.open_url}" target="_blank" rel="noopener noreferrer">Öffnen</a>` : '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  showCreateForm() {
    window.setHeadline('Neue Rechnung anlegen');
    const formHtml = window.formSystem.renderFormOnly('rechnung');
    window.content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neue Rechnung anlegen</h1>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/rechnung')" class="secondary-btn">Zurück</button>
        </div>
      </div>
      <div class="form-page">${formHtml}</div>
    `;
    window.formSystem.bindFormEvents('rechnung', null);
    const form = document.getElementById('rechnung-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleCreateSubmit();
      };
    }
  }

  async handleCreateSubmit() {
    try {
      const form = document.getElementById('rechnung-form');
      const formData = new FormData(form);
      const submitData = {};
      for (const [key, value] of formData.entries()) {
        submitData[key] = value;
      }

      // PDF Upload via UploaderField (Single)
      const pdfUploaderRoot = form.querySelector('.uploader[data-name="pdf_file"]');
      let pdf_url = null;
      let pdf_path = null;
      if (pdfUploaderRoot && pdfUploaderRoot.__uploaderInstance && pdfUploaderRoot.__uploaderInstance.files.length && window.supabase) {
        const file = pdfUploaderRoot.__uploaderInstance.files[0];
        const bucket = 'rechnungen';
        const path = `${submitData.unternehmen_id || 'unknown'}/${Date.now()}_${file.name}`;
        const { error: upErr } = await window.supabase.storage.from(bucket).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });
        if (upErr) throw upErr;
        const { data } = window.supabase.storage.from(bucket).getPublicUrl(path);
        pdf_url = data.publicUrl;
        pdf_path = path;
      }

      if (pdf_url) {
        submitData.pdf_url = pdf_url;
        submitData.pdf_path = pdf_path;
      }

      const result = await window.dataService.createEntity('rechnung', submitData);
      if (result.success) {
        // Multi-Upload Belege via UploaderField (Multi) in separatem Bucket 'rechnung-belege'
        try {
          const belegeUploaderRoot = form.querySelector('.uploader[data-name="belege_files"]');
          if (belegeUploaderRoot && belegeUploaderRoot.__uploaderInstance && belegeUploaderRoot.__uploaderInstance.files.length && window.supabase) {
            const rechnungId = result.id;
            const files = Array.from(belegeUploaderRoot.__uploaderInstance.files);
            for (const file of files) {
              const belegeBucket = 'rechnung-belege';
              const belegePath = `${rechnungId}/${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`;
              const { error: upErr } = await window.supabase.storage.from(belegeBucket).upload(belegePath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type
              });
              if (upErr) throw upErr;
              // Signierte URL (privater Bucket)
              const { data: signed } = await window.supabase.storage.from(belegeBucket).createSignedUrl(belegePath, 60 * 60 * 24 * 7); // 7 Tage
              const file_url = signed?.signedUrl || '';
              // Metadaten in rechnung_belege speichern
              await window.supabase.from('rechnung_belege').insert({
                rechnung_id: rechnungId,
                file_name: file.name,
                file_path: belegePath,
                file_url,
                content_type: file.type,
                size: file.size,
                uploaded_by: window.currentUser?.id || null
              });
            }
          }
        } catch (belegeErr) {
          console.warn('⚠️ Belege-Upload teilweise fehlgeschlagen:', belegeErr);
        }
        alert('Rechnung erstellt');
        window.navigateTo(`/rechnung/${result.id}`);
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }
    } catch (e) {
      alert(`Fehler: ${e.message}`);
    }
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-edit-rechnung') {
        this.showEditForm();
      }
    });
  }

  showEditForm() {
    const formHtml = window.formSystem.renderFormOnly('rechnung', this.data);
    window.content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Rechnung bearbeiten</h1>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/rechnung/${this.id}')" class="secondary-btn">Abbrechen</button>
        </div>
      </div>
      <div class="form-page">${formHtml}</div>
    `;
    window.formSystem.bindFormEvents('rechnung', this.data);
  }
}

export const rechnungDetail = new RechnungDetail();


