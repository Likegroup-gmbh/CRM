// RechnungDetail.js (ES6-Modul)
import { findSignedVertragForKooperation } from './RechnungVertragZuordnung.js';
import { renderSegmentedControl, bindSegmentSwitcher, handleContractingCreateSubmit, handleContractingEditSubmit } from './RechnungContractingCreate.js';
import { uploadRechnungPdf, uploadRechnungBeleg } from '../../core/DropboxDocumentUploader.js';
import { resolveRechnungPathMetadata } from '../../core/RechnungPathMetadata.js';

// Pfade die mit "/" anfangen sind Dropbox-Pfade (neue Uploads), alle anderen
// sind Legacy Supabase Storage-Pfade. Für Dropbox-Pfade reicht die
// gespeicherte file_url (Shared Link), für Supabase müssen wir publicUrl bauen.
function isDropboxPath(filePath) {
  return typeof filePath === 'string' && filePath.startsWith('/');
}

function resolveDocumentUrl(row, supabaseBucket) {
  if (!row) return '';
  if (isDropboxPath(row.file_path)) {
    return row.file_url || '';
  }
  try {
    const { data } = window.supabase.storage.from(supabaseBucket).getPublicUrl(row.file_path);
    return data?.publicUrl || row.file_url || '';
  } catch {
    return row.file_url || '';
  }
}

export class RechnungDetail {
  constructor() {
    this.id = null;
    this.data = null;
    this.belege = [];
    this.pdfs = [];
    this._abortController = null;
  }

  async init(id) {
    this.id = id;
    if (id === 'new') {
      return this.showCreateForm();
    }
    await this.load();
    
    // Breadcrumb aktualisieren mit Edit-Button
    if (window.breadcrumbSystem && this.data) {
      const isAdmin = window.isAdmin();
      const isBezahlt = this.data?.status === 'Bezahlt';
      const hasEditPermission = window.currentUser?.permissions?.rechnung?.can_edit !== false;
      // Bezahlte Rechnungen dürfen nur von Admins bearbeitet werden
      const canEdit = hasEditPermission && (!isBezahlt || isAdmin);
      window.breadcrumbSystem.updateDetailLabel(this.data.rechnung_nr || 'Details', {
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
        auftrag:auftrag!rechnung_auftrag_id_fkey(id, auftragsname, auftrag_details(id)),
        kampagne:kampagne!rechnung_kampagne_id_fkey(id, kampagnenname),
        kooperation:kooperationen!rechnung_kooperation_id_fkey(id, name),
        creator:creator!rechnung_creator_id_fkey(id, vorname, nachname),
        created_by:benutzer!fk_rechnung_created_by(id, name)
      `)
      .eq('id', this.id)
      .single();
    if (error) throw error;
    this.data = data;

    // Belege zu dieser Rechnung laden.
    // Dropbox-Pfade (file_path beginnt mit "/") → file_url ist bereits ein Shared Link.
    // Legacy Supabase-Pfade → publicUrl aus Bucket generieren.
    try {
      const { data: belegeRows } = await window.supabase
        .from('rechnung_belege')
        .select('id, file_name, file_path, file_url, content_type, size, uploaded_at, uploaded_by')
        .eq('rechnung_id', this.id)
        .order('uploaded_at', { ascending: false });
      const processed = (belegeRows || []).map(row => ({ ...row, open_url: resolveDocumentUrl(row, 'rechnung-belege') }));
      this.belege = processed;
    } catch (err) {
      console.warn('⚠️ Fehler beim Laden der Belege:', err?.message);
      this.belege = [];
    }

    // PDFs zu dieser Rechnung laden (gleiche Dropbox/Supabase-Unterscheidung wie bei Belegen)
    try {
      const { data: pdfRows } = await window.supabase
        .from('rechnung_pdfs')
        .select('id, file_name, file_path, file_url, content_type, size, uploaded_at, uploaded_by')
        .eq('rechnung_id', this.id)
        .order('uploaded_at', { ascending: false });
      const pdfProcessed = (pdfRows || []).map(row => ({ ...row, open_url: resolveDocumentUrl(row, 'rechnungen') }));
      this.pdfs = pdfProcessed;
    } catch (err) {
      console.warn('⚠️ Fehler beim Laden der PDFs:', err?.message);
      this.pdfs = [];
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
            <div class="detail-item"><label>Auftrag</label><span>${this.data?.auftrag ? `<a href="#" class="table-link" data-table="auftragsdetails" data-id="${this.data.auftrag.auftrag_details?.[0]?.id || this.data.auftrag.id}">${this.data.auftrag.auftragsname || '-'}</a>` : '-'}</span></div>
            <div class="detail-item"><label>Status</label><span>${this.data?.status || '-'}</span></div>
            <div class="detail-item"><label>Erstellt von</label><span>${this.data?.created_by?.name || '-'}</span></div>
            <div class="detail-item"><label>Gestellt am</label><span>${formatDate(this.data?.gestellt_am)}</span></div>
            <div class="detail-item"><label>Zahlungsziel</label><span>${formatDate(this.data?.zahlungsziel)}</span></div>
            <div class="detail-item"><label>Bezahlt am</label><span>${formatDate(this.data?.bezahlt_am)}</span></div>
            <div class="detail-item"><label>Nettobetrag</label><span>${formatCurrency(this.data?.nettobetrag)}</span></div>
            <div class="detail-item"><label>Zusatzkosten</label><span>${formatCurrency(this.data?.zusatzkosten)}</span></div>
            <div class="detail-item"><label>Bruttobetrag</label><span>${formatCurrency(this.data?.bruttobetrag)}</span></div>
            ${this.data?.rechnungstyp === 'contracting' ? `<div class="detail-item"><label>KSK-pflichtig</label><span>${this.data?.ksk_pflichtig ? 'Ja' : 'Nein'}</span></div>` : ''}
            <div class="detail-item"><label>PDFs</label><span>${this.pdfs && this.pdfs.length > 0 ? this.pdfs.map((p, i) => `<a href="${p.open_url}" target="_blank" rel="noopener noreferrer">${window.validatorSystem?.sanitizeHtml?.(p.file_name) || ('PDF ' + (i + 1))}</a>`).join(' &middot; ') : (this.data?.pdf_url ? `<a href="${this.data.pdf_url}" target="_blank" rel="noopener noreferrer">Öffnen</a>` : '-')}</span></div>
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

  showCreateForm(initialType = null) {
    window.setHeadline('Neue Rechnung anlegen');
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel('Neue Rechnung');
    }

    const params = new URLSearchParams(window.location.search);
    const type = initialType || params.get('type') || 'kampagne';
    this._currentCreateType = type;

    this._renderCreateFormForType(type);
  }

  _renderCreateFormForType(type) {
    this._currentCreateType = type;
    const entity = type === 'contracting' ? 'rechnung_contracting' : 'rechnung';
    const formHtml = window.formSystem.renderFormOnly(entity);

    window.content.innerHTML = `
      <div class="form-page">
        ${renderSegmentedControl(type)}
        ${formHtml}
      </div>
    `;

    window.formSystem.bindFormEvents(entity, null);

    const form = document.getElementById(`${entity}-form`);
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        if (type === 'contracting') {
          await handleContractingCreateSubmit(form);
        } else {
          await this.handleCreateSubmit();
        }
      };
    }

    bindSegmentSwitcher(window.content, (newType) => {
      this._renderCreateFormForType(newType);
    });
  }

  async validateVertragForKooperation(kooperationId) {
    if (!kooperationId || !window.supabase) {
      return { ok: false, message: 'Bitte zuerst eine gueltige Kooperation auswaehlen.', vertragId: null };
    }
    return findSignedVertragForKooperation(kooperationId);
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

      if (vertragCheck.vertragId) {
        submitData.vertrag_id = vertragCheck.vertragId;
      }

      // Rechnungs-Name dynamisch generieren aus Kooperationsname
      const koopLabel = form.querySelector('select[name="kooperation_id"]')?.parentNode
        .querySelector('.searchable-select-input')?.value || '';
      submitData.rechnung_nr = koopLabel || `Rechnung-${Date.now()}`;
      console.log('📋 Generierter Rechnungsname:', submitData.rechnung_nr);

      console.log('📋 Submit-Daten vor Übertragung:', submitData);
      console.log('🔍 auftrag_id Wert:', submitData.auftrag_id, typeof submitData.auftrag_id);

      // PDF Upload → Dropbox (rechnung_pdfs.file_path enthält den Dropbox-Pfad)
      const pdfUploaderRoot = form.querySelector('.uploader[data-name="pdf_file"]');
      const pdfFiles = [];
      const pathMeta = await resolveRechnungPathMetadata({
        unternehmenId: submitData.unternehmen_id,
        kampagneId: submitData.kampagne_id,
        kooperationId: submitData.kooperation_id,
        rechnungsNr: submitData.rechnung_nr,
      });
      if (pdfUploaderRoot && pdfUploaderRoot.__uploaderInstance && pdfUploaderRoot.__uploaderInstance.files.length) {
        const files = Array.from(pdfUploaderRoot.__uploaderInstance.files);
        for (const file of files) {
          const result = await uploadRechnungPdf({
            metadata: pathMeta,
            file,
          });
          pdfFiles.push({
            file_name: file.name,
            file_path: result.filePath,
            file_url: result.fileUrl,
            content_type: file.type,
            size: file.size,
          });
        }
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
        try {
          const { syncEkZusatzkostenAfterRechnungSave } = await import('../../core/RechnungZusatzkostenSync.js');
          await syncEkZusatzkostenAfterRechnungSave(result.id);
        } catch (syncErr) {
          console.warn('Zusatzkosten-Sync fehlgeschlagen:', syncErr);
        }

        // PDF-Metadaten in rechnung_pdfs speichern
        try {
          const rechnungId = result.id;
          for (const pdf of pdfFiles) {
            await window.supabase.from('rechnung_pdfs').insert({
              rechnung_id: rechnungId,
              file_name: pdf.file_name,
              file_path: pdf.file_path,
              file_url: pdf.file_url,
              content_type: pdf.content_type,
              size: pdf.size,
              uploaded_by: window.currentUser?.auth_user_id || null
            });
          }
        } catch (pdfErr) {
          console.warn('⚠️ PDF-Metadaten teilweise fehlgeschlagen:', pdfErr);
        }

        // Multi-Upload Belege → Dropbox (rechnung_belege.file_path enthält Dropbox-Pfad)
        try {
          const belegeUploaderRoot = form.querySelector('.uploader[data-name="belege_files"]');
          if (belegeUploaderRoot && belegeUploaderRoot.__uploaderInstance && belegeUploaderRoot.__uploaderInstance.files.length) {
            const rechnungId = result.id;
            const files = Array.from(belegeUploaderRoot.__uploaderInstance.files);
            for (const file of files) {
              const uploadResult = await uploadRechnungBeleg({
                metadata: pathMeta,
                file,
              });
              await window.supabase.from('rechnung_belege').insert({
                rechnung_id: rechnungId,
                file_name: file.name,
                file_path: uploadResult.filePath,
                file_url: uploadResult.fileUrl,
                content_type: file.type,
                size: file.size,
                uploaded_by: window.currentUser?.auth_user_id || null
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
    this._abortController?.abort();
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-edit-rechnung')) {
        const isAdmin = window.isAdmin();
        const isBezahlt = this.data?.status === 'Bezahlt';
        if (isBezahlt && !isAdmin) {
          window.toastSystem?.show?.('Bezahlte Rechnungen können nur von Admins bearbeitet werden.', 'warning');
          return;
        }
        this.showEditForm();
      }
      const link = e.target.closest('.table-link[data-table][data-id]');
      if (link) {
        e.preventDefault();
        const table = link.dataset.table;
        const id = link.dataset.id;
        if (table && id) window.navigateTo(`/${table}/${id}`);
      }
    }, { signal });
  }

  destroy() {
    this._abortController?.abort();
    this._abortController = null;
    window.setContentSafely?.(window.content, '');
  }

  async showEditForm() {
    const isContracting = this.data?.rechnungstyp === 'contracting';
    const entity = isContracting ? 'rechnung_contracting' : 'rechnung';
    const editData = {
      ...this.data,
      _isEditMode: true,
      _entityId: this.id
    };
    
    const formHtml = window.formSystem.renderFormOnly(entity, editData);
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
    await window.formSystem.bindFormEvents(entity, editData);

    // Uploader werden per setTimeout(0) gemountet – kurz warten
    await new Promise(r => setTimeout(r, 50));

    const belegeUploader = document.querySelector('.uploader[data-name="belege_files"]')?.__uploaderInstance;
    if (belegeUploader && this.belege.length > 0) {
      belegeUploader.setExistingFiles(this.belege.map(b => ({
        id: b.id,
        name: b.file_name,
        url: b.open_url,
        path: b.file_path,
        size: b.size
      })));
    }

    const pdfUploader = document.querySelector('.uploader[data-name="pdf_file"]')?.__uploaderInstance;
    if (pdfUploader && this.pdfs && this.pdfs.length > 0) {
      pdfUploader.setExistingFiles(this.pdfs.map(p => ({
        id: p.id,
        name: p.file_name,
        url: p.open_url,
        path: p.file_path,
        size: p.size
      })));
    }
  }
}

export const rechnungDetail = new RechnungDetail();


