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
    
    // Breadcrumb aktualisieren mit Edit-Button
    if (window.breadcrumbSystem && this.data) {
      const canEdit = window.currentUser?.permissions?.rechnung?.can_edit !== false;
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Rechnung', url: '/rechnung', clickable: true },
        { label: this.data.rechnung_nr || 'Details', url: `/rechnung/${this.id}`, clickable: false }
      ], {
        id: 'btn-edit-rechnung',
        canEdit: canEdit
      });
    }
    
    this.render();
    this.bindEvents();
  }

  async load() {
    const { data, error } = await window.supabase
      .from('rechnung')
      .select(`*,
        unternehmen:unternehmen!rechnung_unternehmen_id_fkey(id, firmenname),
        auftrag:auftrag!rechnung_auftrag_id_fkey(id, auftragsname),
        kampagne:kampagne!rechnung_kampagne_id_fkey(id, kampagnenname),
        kooperation:kooperationen!rechnung_kooperation_id_fkey(id, name),
        creator:creator!rechnung_creator_id_fkey(id, vorname, nachname),
        created_by:benutzer!fk_rechnung_created_by(id, name)
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
        // Permanente Public URL generieren
        const { data: urlData } = window.supabase.storage
          .from(bucket)
          .getPublicUrl(row.file_path);
        const openUrl = urlData?.publicUrl || row.file_url || '';
        processed.push({ ...row, open_url: openUrl });
      }
      this.belege = processed;
    } catch (err) {
      console.warn('⚠️ Fehler beim Laden der Belege:', err?.message);
      this.belege = [];
    }
  }

  render() {
    window.setHeadline(`Rechnung ${this.data?.rechnung_nr || ''}`);
    const formatCurrency = (v) => v == null ? '-' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
    const formatDate = (v) => v ? new Intl.DateTimeFormat('de-DE').format(new Date(v)) : '-';

    const html = `
      <div class="content-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Allgemein</h3>
            <div class="detail-item"><label>Rechnungs-Nr</label><span>${this.data?.rechnung_nr || '-'}</span></div>
            <div class="detail-item"><label>Interne PO-Nummer</label><span>${this.data?.po_nummer || '-'}</span></div>
            <div class="detail-item"><label>Externe Angebotsnummer</label><span>${this.data?.externe_angebotsnummer || '-'}</span></div>
            <div class="detail-item"><label>Unternehmen</label><span>${this.data?.unternehmen?.firmenname || '-'}</span></div>
            <div class="detail-item"><label>Auftrag</label><span>${this.data?.auftrag?.auftragsname || '-'}</span></div>
            <div class="detail-item"><label>Status</label><span>${this.data?.status || '-'}</span></div>
            <div class="detail-item"><label>Erstellt von</label><span>${this.data?.created_by?.name || '-'}</span></div>
            <div class="detail-item"><label>Gestellt am</label><span>${formatDate(this.data?.gestellt_am)}</span></div>
            <div class="detail-item"><label>Zahlungsziel</label><span>${formatDate(this.data?.zahlungsziel)}</span></div>
            <div class="detail-item"><label>Bezahlt am</label><span>${formatDate(this.data?.bezahlt_am)}</span></div>
            <div class="detail-item"><label>Nettobetrag</label><span>${formatCurrency(this.data?.nettobetrag)}</span></div>
            <div class="detail-item"><label>Zusatzkosten</label><span>${formatCurrency(this.data?.zusatzkosten)}</span></div>
            <div class="detail-item"><label>Bruttobetrag</label><span>${formatCurrency(this.data?.bruttobetrag)}</span></div>
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
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Rechnung', url: '/rechnung', clickable: true },
        { label: 'Neue Rechnung', url: '/rechnung/new', clickable: false }
      ]);
    }
    
    const formHtml = window.formSystem.renderFormOnly('rechnung');
    window.content.innerHTML = `
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

  async validateVertragForKooperation(kooperationId) {
    if (!kooperationId || !window.supabase) {
      return { ok: false, message: 'Bitte zuerst eine gueltige Kooperation auswaehlen.' };
    }

    const { data: koop, error: koopError } = await window.supabase
      .from('kooperationen')
      .select('id, creator_id, kampagne_id')
      .eq('id', kooperationId)
      .single();

    if (koopError || !koop) {
      return { ok: false, message: 'Die ausgewaehlte Kooperation konnte nicht geladen werden.' };
    }

    if (!koop.creator_id || !koop.kampagne_id) {
      return { ok: false, message: 'Die Kooperation ist unvollstaendig (Creator oder Kampagne fehlt).' };
    }

    const { data: vertraege, error: vertragError } = await window.supabase
      .from('vertraege')
      .select('id')
      .eq('creator_id', koop.creator_id)
      .eq('kampagne_id', koop.kampagne_id)
      .eq('is_draft', false)
      .limit(1);

    if (vertragError) {
      return { ok: false, message: 'Vertrag konnte nicht geprueft werden. Bitte erneut versuchen.' };
    }

    if (!vertraege || vertraege.length === 0) {
      return { ok: false, message: 'Vor der Rechnung muss ein finaler Vertrag angelegt werden.' };
    }

    return { ok: true };
  }

  mapRechnungCreateError(errorMessage) {
    const msg = String(errorMessage || '').trim();
    if (!msg) return 'Unbekannter Fehler beim Erstellen der Rechnung.';

    if (msg.includes('RECHNUNG_VERTRAG_REQUIRED')) {
      return 'Vor der Rechnung muss ein finaler Vertrag zur Kooperation vorhanden sein.';
    }

    if (msg.includes('duplicate key') && msg.includes('kooperation_id')) {
      return 'Fuer diese Kooperation existiert bereits eine Rechnung.';
    }

    if (msg.includes('rechnung_kooperation_id_fkey')) {
      return 'Die ausgewaehlte Kooperation ist nicht mehr gueltig.';
    }

    return msg;
  }

  async handleCreateSubmit() {
    try {
      const form = document.getElementById('rechnung-form');
      const formData = new FormData(form);
      const submitData = {};
      for (const [key, value] of formData.entries()) {
        submitData[key] = value;
      }

      // Spezielle Behandlung für searchable Select-Felder
      // Diese haben versteckte Select-Elemente, die möglicherweise nicht korrekt aktualisiert wurden
      const searchableSelects = form.querySelectorAll('select[data-searchable="true"]');
      searchableSelects.forEach(select => {
        const container = select.parentNode.querySelector('.searchable-select-container');
        if (container) {
          const input = container.querySelector('.searchable-select-input');
          if (input && input.value) {
            // Prüfe ob der Input-Wert einer gültigen Option entspricht
            const options = Array.from(select.options);
            const matchingOption = options.find(opt => opt.textContent.trim() === input.value.trim());
            if (matchingOption) {
              submitData[select.name] = matchingOption.value;
              console.log(`✅ Searchable Select ${select.name} korrigiert: ${input.value} → ${matchingOption.value}`);
            }
          }
        }
      });

      // Validierung der required Felder
      const requiredFields = ['auftrag_id', 'kooperation_id', 'unternehmen_id', 'kampagne_id'];
      const missingFields = requiredFields.filter(field => !submitData[field] || submitData[field].trim() === '');
      
      if (missingFields.length > 0) {
        alert(`Bitte füllen Sie alle Pflichtfelder aus: ${missingFields.join(', ')}`);
        return;
      }

      const vertragCheck = await this.validateVertragForKooperation(submitData.kooperation_id);
      if (!vertragCheck.ok) {
        alert(vertragCheck.message);
        return;
      }

      // Rechnungs-Name dynamisch generieren aus Kooperationsname
      const koopLabel = form.querySelector('select[name="kooperation_id"]')?.parentNode
        .querySelector('.searchable-select-input')?.value || '';
      submitData.rechnung_nr = koopLabel || `Rechnung-${Date.now()}`;
      console.log('📋 Generierter Rechnungsname:', submitData.rechnung_nr);

      console.log('📋 Submit-Daten vor Übertragung:', submitData);
      console.log('🔍 auftrag_id Wert:', submitData.auftrag_id, typeof submitData.auftrag_id);

      // PDF Upload via UploaderField (Single)
      const pdfUploaderRoot = form.querySelector('.uploader[data-name="pdf_file"]');
      let pdf_url = null;
      let pdf_path = null;
      if (pdfUploaderRoot && pdfUploaderRoot.__uploaderInstance && pdfUploaderRoot.__uploaderInstance.files.length && window.supabase) {
        const file = pdfUploaderRoot.__uploaderInstance.files[0];
        const sanitizedName = file.name
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .replace(/\.{2,}/g, '_')
          .substring(0, 200);
        const bucket = 'rechnungen';
        const path = `${submitData.unternehmen_id || 'unknown'}/${Date.now()}_${sanitizedName}`;
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

      // Ersteller automatisch setzen
      submitData.created_by_id = window.currentUser?.id || null;

      // PO-Nummer aus verknüpftem Auftrag übernehmen
      if (submitData.auftrag_id && window.supabase) {
        try {
          const { data: auftrag, error: poErr } = await window.supabase
            .from('auftrag')
            .select('po, externe_po')
            .eq('id', submitData.auftrag_id)
            .single();

          if (!poErr && auftrag) {
            if (auftrag.po) {
              submitData.po_nummer = auftrag.po;
              console.log('✅ PO-Nummer aus Auftrag übernommen:', auftrag.po);
            }
            // Externe PO nur übernehmen, wenn im Formular nicht bereits manuell eingegeben
            if (auftrag.externe_po && !submitData.externe_angebotsnummer) {
              submitData.externe_angebotsnummer = auftrag.externe_po;
              console.log('✅ Externe PO aus Auftrag übernommen:', auftrag.externe_po);
            }
          } else if (poErr) {
            console.warn('⚠️ PO-Nummer konnte nicht aus Auftrag geladen werden:', poErr.message);
          }
        } catch (e) {
          console.warn('⚠️ Fehler beim Laden der PO-Nummer:', e.message);
        }
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
              const belegeSanitizedName = file.name
                .replace(/[^a-zA-Z0-9._-]/g, '_')
                .replace(/\.{2,}/g, '_')
                .substring(0, 200);
              const belegeBucket = 'rechnung-belege';
              const belegePath = `${rechnungId}/${Date.now()}_${Math.random().toString(36).slice(2)}_${belegeSanitizedName}`;
              const { error: upErr } = await window.supabase.storage.from(belegeBucket).upload(belegePath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type
              });
              if (upErr) throw upErr;
              // Permanente Public URL generieren
              const { data: urlData } = window.supabase.storage.from(belegeBucket).getPublicUrl(belegePath);
              const file_url = urlData?.publicUrl || '';
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
        throw new Error(this.mapRechnungCreateError(result.error || 'Unbekannter Fehler'));
      }
    } catch (e) {
      alert(`Fehler: ${this.mapRechnungCreateError(e?.message)}`);
    }
  }

  // Generiert eine fortlaufende PO-Nummer im Format PO-JJJJ-NNNN
  async generatePoNummer() {
    const currentYear = new Date().getFullYear();
    const prefix = `PO-${currentYear}-`;
    
    try {
      // Höchste PO-Nummer des aktuellen Jahres ermitteln
      const { data: rechnungen, error } = await window.supabase
        .from('rechnung')
        .select('po_nummer')
        .like('po_nummer', `${prefix}%`)
        .order('po_nummer', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('❌ Fehler beim Laden der PO-Nummern:', error);
        // Fallback: Timestamp-basierte Nummer
        return `${prefix}${Date.now().toString().slice(-4)}`;
      }
      
      let nextNumber = 1;
      
      if (rechnungen && rechnungen.length > 0 && rechnungen[0].po_nummer) {
        // Extrahiere die Nummer aus dem Format PO-JJJJ-NNNN
        const lastPoNummer = rechnungen[0].po_nummer;
        const match = lastPoNummer.match(/PO-\d{4}-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      
      // Format: PO-JJJJ-NNNN (4-stellig mit führenden Nullen)
      const poNummer = `${prefix}${nextNumber.toString().padStart(4, '0')}`;
      console.log(`✅ Neue PO-Nummer generiert: ${poNummer}`);
      
      return poNummer;
    } catch (e) {
      console.error('❌ Fehler bei PO-Nummer Generierung:', e);
      // Fallback: Timestamp-basierte Nummer
      return `${prefix}${Date.now().toString().slice(-4)}`;
    }
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-edit-rechnung')) {
        this.showEditForm();
      }
    });
  }

  showEditForm() {
    // Edit-Mode Flags setzen für FormSystem
    const editData = {
      ...this.data,
      _isEditMode: true,
      _entityId: this.id
    };
    
    const formHtml = window.formSystem.renderFormOnly('rechnung', editData);
    window.content.innerHTML = `
      <div class="page-header">
        <div class="page-header-right">
          <button onclick="window.navigateTo('/rechnung/${this.id}')" class="mdc-btn mdc-btn--cancel">
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
        </div>
      </div>
      <div class="form-page">${formHtml}</div>
    `;
    window.formSystem.bindFormEvents('rechnung', editData);
  }
}

export const rechnungDetail = new RechnungDetail();


