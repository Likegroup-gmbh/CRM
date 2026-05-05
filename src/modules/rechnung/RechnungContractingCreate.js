// Contracting-spezifische Create/Edit-Logik fuer Rechnungen
// Segmented Control, Submit-Handler, File-Uploads

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

  // PDF Upload
  const pdfFiles = await uploadFiles(form, 'pdf_file', 'rechnungen', submitData.unternehmen_id);

  try {
    const result = await window.dataService.createEntity('rechnung', submitData);
    if (!result.success) throw new Error(result.error || 'Unbekannter Fehler');

    const rechnungId = result.id;

    await savePdfMetadata(rechnungId, pdfFiles);
    await uploadBelege(form, rechnungId);

    alert('Contracting-Rechnung erstellt');
    window.navigateTo(`/rechnung/${rechnungId}`);
    return rechnungId;
  } catch (e) {
    alert(`Fehler: ${e.message}`);
    return null;
  }
}

// --- Contracting Submit (Edit) ---

export async function handleContractingEditSubmit(form, existingRechnung) {
  const formData = new FormData(form);
  const submitData = {};
  for (const [key, value] of formData.entries()) {
    submitData[key] = value;
  }

  submitData.rechnungstyp = 'contracting';
  submitData.kampagne_id = null;
  submitData.kooperation_id = null;

  try {
    const { error } = await window.supabase
      .from('rechnung')
      .update(submitData)
      .eq('id', existingRechnung.id);
    if (error) throw error;

    alert('Rechnung aktualisiert');
    window.navigateTo(`/rechnung/${existingRechnung.id}`);
  } catch (e) {
    alert(`Fehler: ${e.message}`);
  }
}

// --- Helpers ---

function fixSearchableSelectValues(form, submitData) {
  const searchableSelects = form.querySelectorAll('select[data-searchable="true"]');
  searchableSelects.forEach(select => {
    const container = select.parentNode.querySelector('.searchable-select-container');
    if (container) {
      const input = container.querySelector('.searchable-select-input');
      if (input?.value) {
        const match = Array.from(select.options).find(opt => opt.textContent.trim() === input.value.trim());
        if (match) submitData[select.name] = match.value;
      }
    }
  });
}

async function fillPoFromAuftrag(submitData) {
  try {
    const { data: auftrag } = await window.supabase
      .from('auftrag')
      .select('po, externe_po')
      .eq('id', submitData.auftrag_id)
      .single();
    if (auftrag?.po) submitData.po_nummer = auftrag.po;
    if (auftrag?.externe_po && !submitData.externe_angebotsnummer) {
      submitData.externe_angebotsnummer = auftrag.externe_po;
    }
  } catch { /* non-critical */ }
}

async function uploadFiles(form, fieldName, bucket, folderId) {
  const uploaderRoot = form.querySelector(`.uploader[data-name="${fieldName}"]`);
  const files = [];
  if (!uploaderRoot?.__uploaderInstance?.files?.length || !window.supabase) return files;

  for (const file of Array.from(uploaderRoot.__uploaderInstance.files)) {
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '_').substring(0, 200);
    const path = `${folderId || 'unknown'}/${Date.now()}_${Math.random().toString(36).slice(2)}_${sanitized}`;
    const { error } = await window.supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type
    });
    if (error) throw error;
    const { data } = window.supabase.storage.from(bucket).getPublicUrl(path);
    files.push({ file_name: file.name, file_path: path, file_url: data.publicUrl || '', content_type: file.type, size: file.size });
  }
  return files;
}

async function savePdfMetadata(rechnungId, pdfFiles) {
  for (const pdf of pdfFiles) {
    await window.supabase.from('rechnung_pdfs').insert({
      rechnung_id: rechnungId,
      file_name: pdf.file_name, file_path: pdf.file_path, file_url: pdf.file_url,
      content_type: pdf.content_type, size: pdf.size,
      uploaded_by: window.currentUser?.id || null
    });
  }
}

async function uploadBelege(form, rechnungId) {
  const uploaderRoot = form.querySelector('.uploader[data-name="belege_files"]');
  if (!uploaderRoot?.__uploaderInstance?.files?.length || !window.supabase) return;

  const bucket = 'rechnung-belege';
  for (const file of Array.from(uploaderRoot.__uploaderInstance.files)) {
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '_').substring(0, 200);
    const path = `${rechnungId}/${Date.now()}_${Math.random().toString(36).slice(2)}_${sanitized}`;
    const { error } = await window.supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type
    });
    if (error) throw error;
    const { data } = window.supabase.storage.from(bucket).getPublicUrl(path);
    await window.supabase.from('rechnung_belege').insert({
      rechnung_id: rechnungId,
      file_name: file.name, file_path: path, file_url: data?.publicUrl || '',
      content_type: file.type, size: file.size,
      uploaded_by: window.currentUser?.id || null
    });
  }
}
