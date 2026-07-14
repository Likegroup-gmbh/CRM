// Contracting-spezifische Create/Edit-Logik fuer Rechnungen
// Segmented Control, Submit-Handler, File-Uploads

import { uploadRechnungPdf, uploadRechnungBeleg } from '../../core/DropboxDocumentUploader.js';
import { resolveRechnungPathMetadata } from '../../core/RechnungPathMetadata.js';

// --- Segmented Control ---

export function renderSegmentedControl(activeType = 'kampagne') {
  return `
    <div class="rechnung-type-switcher">
      <button class="segment-btn ${activeType === 'kampagne' ? 'active' : ''}" data-rechnung-type="kampagne">Kampagne</button>
      <button class="segment-btn ${activeType === 'contracting' ? 'active' : ''}" data-rechnung-type="contracting">Contracting</button>
    </div>
  `;
}

export function bindSegmentSwitcher(container, onSwitch) {
  const buttons = container.querySelectorAll('.segment-btn[data-rechnung-type]');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const type = btn.dataset.rechnungType;
      buttons.forEach(b => b.classList.toggle('active', b === btn));
      onSwitch(type);
    });
  });
}

// --- Contracting Submit (Create) ---

export async function handleContractingCreateSubmit(form) {
  const formData = new FormData(form);
  const submitData = {};
  for (const [key, value] of formData.entries()) {
    submitData[key] = value;
  }

  fixSearchableSelectValues(form, submitData);

  const requiredFields = ['auftrag_id'];
  const missing = requiredFields.filter(f => !submitData[f]?.trim());
  if (missing.length > 0) {
    alert(`Bitte alle Pflichtfelder ausfüllen: ${missing.join(', ')}`);
    return null;
  }

  submitData.rechnungstyp = 'contracting';
  submitData.kampagne_id = null;
  submitData.kooperation_id = null;
  submitData.vertrag_id = null;
  submitData.contracting_position_id = null;
  submitData.created_by_id = window.currentUser?.id || null;
  submitData.ksk_pflichtig = submitData.ksk_pflichtig === 'on' || submitData.ksk_pflichtig === true || submitData.ksk_pflichtig === 'true';

  // Rechnungs-Nr aus Contract-Label oder Fallback
  const contractSelect = form.querySelector('select[name="auftrag_id"]');
  const contractLabel = contractSelect?.parentNode?.querySelector('.searchable-select-input')?.value || '';
  submitData.rechnung_nr = contractLabel ? `CTR-${contractLabel.substring(0, 50)}` : `CTR-${Date.now()}`;

  // Budget-Check: Gesamtsumme darf Contract-Budget nicht ueberschreiten
  const contractBudget = parseFloat(form.dataset.contractBudget) || 0;
  const bereitsVergeben = parseFloat(form.dataset.bereitsVergeben) || 0;
  const neuerBetrag = parseFloat(submitData.nettobetrag) || 0;

  if (contractBudget > 0 && (bereitsVergeben + neuerBetrag) > contractBudget) {
    const gesamt = bereitsVergeben + neuerBetrag;
    const fmt = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
    alert(`Die Gesamtsumme (${fmt(gesamt)}) überschreitet das Contract-Budget von ${fmt(contractBudget)}.\n\nBereits vergeben: ${fmt(bereitsVergeben)}\nNeuer Betrag: ${fmt(neuerBetrag)}\nBudget: ${fmt(contractBudget)}`);
    return null;
  }

  // PO aus Auftrag uebernehmen
  if (submitData.auftrag_id) {
    await fillPoFromAuftrag(submitData);
  }

  // Pfad-Metadaten (für Contracting ohne Kampagne) auflösen
  const pathMeta = await resolveRechnungPathMetadata({
    unternehmenId: submitData.unternehmen_id,
    kampagneId: submitData.kampagne_id, // null bei Contracting → Fallback /Contracting/Rechnungen
    kooperationId: submitData.kooperation_id,
    rechnungsNr: submitData.rechnung_nr,
  });

  // PDF Upload → Dropbox
  const pdfFiles = await uploadPdfFiles(form, pathMeta);

  try {
    const result = await window.dataService.createEntity('rechnung', submitData);
    if (!result.success) throw new Error(result.error || 'Unbekannter Fehler');

    const rechnungId = result.id;

    console.log('[ZusatzkostenSync] ContractingCreate-Hook ausgeloest fuer rechnungId=', rechnungId);
    try {
      const { syncEkZusatzkostenAfterRechnungSave } = await import('../../core/RechnungZusatzkostenSync.js');
      await syncEkZusatzkostenAfterRechnungSave(rechnungId);
    } catch (syncErr) {
      console.warn('Zusatzkosten-Sync (Contracting create) fehlgeschlagen:', syncErr);
    }

    await savePdfMetadata(rechnungId, pdfFiles);
    await uploadBelege(form, rechnungId, pathMeta);

    alert('Contracting-Rechnung erstellt');
    window.navigateTo(`/rechnung/${rechnungId}`);
    return rechnungId;
  } catch (e) {
    alert(`Fehler: ${e.message}`);
    return null;
  }
}

// --- Helpers ---

function fixSearchableSelectValues(form, submitData) {
  const searchableSelects = form.querySelectorAll('select[data-searchable="true"]');
  searchableSelects.forEach(select => {
    // Die Searchable-Init entfernt das name-Attribut vom <select>;
    // Feldname daher robust aus dataset/id ableiten.
    const fieldName = select.name
      || select.dataset.fieldName
      || (select.id?.startsWith('field-') ? select.id.slice('field-'.length) : select.id)
      || '';
    if (!fieldName) return;

    const container = select.parentNode.querySelector('.searchable-select-container');
    if (container) {
      const input = container.querySelector('.searchable-select-input');
      if (input?.value) {
        const match = Array.from(select.options).find(opt => opt.textContent.trim() === input.value.trim());
        if (match && match.value) submitData[fieldName] = match.value;
      }
    }

    // Fallback: sichtbares Label fehlt/kein Match, aber das Select selbst hat
    // einen Wert (z. B. via Prefill gesetzt) und submitData noch keinen.
    if (!submitData[fieldName] && select.value) {
      submitData[fieldName] = select.value;
    }
  });
}

async function fillPoFromAuftrag(submitData) {
  try {
    const { data: auftrag } = await window.supabase
      .from('auftrag')
      .select('po, externe_po, unternehmen_id')
      .eq('id', submitData.auftrag_id)
      .single();
    if (auftrag?.po) submitData.po_nummer = auftrag.po;
    if (auftrag?.externe_po && !submitData.externe_angebotsnummer) {
      submitData.externe_angebotsnummer = auftrag.externe_po;
    }
    // Sicherheitsnetz: unternehmen_id ist NOT NULL in der rechnung-Tabelle und
    // im Formular readonly (vom Contract abgeleitet). Falls der Wert im
    // Formular-Submit fehlt (Hidden-Input-Sync), aus dem Contract übernehmen.
    if (!submitData.unternehmen_id && auftrag?.unternehmen_id) {
      submitData.unternehmen_id = auftrag.unternehmen_id;
    }
  } catch { /* non-critical */ }
}

async function uploadPdfFiles(form, pathMeta) {
  const uploaderRoot = form.querySelector('.uploader[data-name="pdf_file"]');
  const files = [];
  if (!uploaderRoot?.__uploaderInstance?.files?.length) return files;

  for (const file of Array.from(uploaderRoot.__uploaderInstance.files)) {
    const result = await uploadRechnungPdf({ metadata: pathMeta, file });
    files.push({
      file_name: file.name,
      file_path: result.filePath,
      file_url: result.fileUrl,
      content_type: file.type,
      size: file.size,
    });
  }
  return files;
}

async function savePdfMetadata(rechnungId, pdfFiles) {
  for (const pdf of pdfFiles) {
    await window.supabase.from('rechnung_pdfs').insert({
      rechnung_id: rechnungId,
      file_name: pdf.file_name, file_path: pdf.file_path, file_url: pdf.file_url,
      content_type: pdf.content_type, size: pdf.size,
      uploaded_by: window.currentUser?.auth_user_id || null
    });
  }
}

async function uploadBelege(form, rechnungId, pathMeta) {
  const uploaderRoot = form.querySelector('.uploader[data-name="belege_files"]');
  if (!uploaderRoot?.__uploaderInstance?.files?.length) return;

  for (const file of Array.from(uploaderRoot.__uploaderInstance.files)) {
    const result = await uploadRechnungBeleg({ metadata: pathMeta, file });
    // uploaded_by referenziert benutzer(id), nicht auth.users - daher currentUser.id
    const { error: belegInsErr } = await window.supabase.from('rechnung_belege').insert({
      rechnung_id: rechnungId,
      file_name: file.name,
      file_path: result.filePath,
      file_url: result.fileUrl,
      content_type: file.type,
      size: file.size,
      uploaded_by: window.currentUser?.id || null
    });
    if (belegInsErr) {
      throw new Error(`Beleg "${file.name}" konnte nicht gespeichert werden: ${belegInsErr.message}`);
    }
  }
}
