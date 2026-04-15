// KampagneDetailEditHandler.js
// Bearbeitungsformular und Form-Submission für Kampagnen

import { transferKampagneDataToAuftragsdetails } from './KampagneDetailTransferService.js';

export function showEditForm(detail) {
  console.log('🎯 KAMPAGNEDETAIL: Zeige Bearbeitungsformular');
  window.setHeadline('Kampagne bearbeiten');

  const formData = { ...detail.kampagneData };
  formData._isEditMode = true;
  formData._entityId = detail.kampagneId;

  if (detail.kampagneData.unternehmen_id) formData.unternehmen_id = detail.kampagneData.unternehmen_id;
  if (detail.kampagneData.marke_id) formData.marke_id = detail.kampagneData.marke_id;
  if (detail.kampagneData.auftrag_id) formData.auftrag_id = detail.kampagneData.auftrag_id;

  formData.ansprechpartner_ids = detail.kampagneData.ansprechpartner ? detail.kampagneData.ansprechpartner.map(a => a.id) : [];
  formData.mitarbeiter_ids = detail.kampagneData.mitarbeiter ? detail.kampagneData.mitarbeiter.map(m => m.id) : [];
  formData.pm_ids = detail.kampagneData.projektmanager ? detail.kampagneData.projektmanager.map(p => p.id) : [];
  formData.scripter_ids = detail.kampagneData.scripter ? detail.kampagneData.scripter.map(s => s.id) : [];
  formData.cutter_ids = detail.kampagneData.cutter ? detail.kampagneData.cutter.map(c => c.id) : [];
  formData.copywriter_ids = detail.kampagneData.copywriter ? detail.kampagneData.copywriter.map(c => c.id) : [];
  formData.strategie_ids = detail.kampagneData.strategie ? detail.kampagneData.strategie.map(s => s.id) : [];
  formData.creator_sourcing_ids = detail.kampagneData.creator_sourcing ? detail.kampagneData.creator_sourcing.map(c => c.id) : [];
  formData.paid_ziele_ids = detail.kampagneData.paid_ziele ? detail.kampagneData.paid_ziele.map(z => z.id) : [];
  formData.organic_ziele_ids = detail.kampagneData.organic_ziele ? detail.kampagneData.organic_ziele.map(z => z.id) : [];

  if (detail.kampagneData.drehort_typ_id) formData.drehort_typ_id = detail.kampagneData.drehort_typ_id;

  if (detail.kampagneData.art_der_kampagne && Array.isArray(detail.kampagneData.art_der_kampagne)) {
    formData.art_der_kampagne = detail.kampagneData.art_der_kampagne;
  }
  if (detail.kampagneData.plattform_ids && Array.isArray(detail.kampagneData.plattform_ids)) {
    formData.plattform_ids = detail.kampagneData.plattform_ids;
  }
  if (detail.kampagneData.format_ids && Array.isArray(detail.kampagneData.format_ids)) {
    formData.format_ids = detail.kampagneData.format_ids;
  }
  if (detail.kampagneData.kampagne_typ) formData.kampagne_typ = detail.kampagneData.kampagne_typ;

  const formHtml = window.formSystem.renderFormOnly('kampagne', formData);
  window.content.innerHTML = `<div class="form-page">${formHtml}</div>`;

  window.formSystem.bindFormEvents('kampagne', formData);

  const form = document.getElementById('kampagne-form');
  if (form) {
    form.dataset.isEditMode = 'true';
    form.dataset.entityType = 'kampagne';
    form.dataset.entityId = detail.kampagneId;

    const editModeData = {
      unternehmen_id: formData.unternehmen_id,
      marke_id: formData.marke_id,
      auftrag_id: formData.auftrag_id,
      drehort_typ_id: formData.drehort_typ_id,
      kampagne_typ: formData.kampagne_typ,
      ansprechpartner_ids: formData.ansprechpartner_ids,
      mitarbeiter_ids: formData.mitarbeiter_ids,
      pm_ids: formData.pm_ids,
      scripter_ids: formData.scripter_ids,
      cutter_ids: formData.cutter_ids,
      copywriter_ids: formData.copywriter_ids,
      strategie_ids: formData.strategie_ids,
      creator_sourcing_ids: formData.creator_sourcing_ids,
      art_der_kampagne: formData.art_der_kampagne,
      plattform_ids: formData.plattform_ids,
      format_ids: formData.format_ids,
      paid_ziele_ids: formData.paid_ziele_ids,
      organic_ziele_ids: formData.organic_ziele_ids,
      ugc_pro_paid_video_anzahl: detail.kampagneData.ugc_pro_paid_video_anzahl,
      ugc_pro_paid_creator_anzahl: detail.kampagneData.ugc_pro_paid_creator_anzahl,
      ugc_pro_paid_bilder_anzahl: detail.kampagneData.ugc_pro_paid_bilder_anzahl,
      ugc_pro_organic_video_anzahl: detail.kampagneData.ugc_pro_organic_video_anzahl || detail.kampagneData.igc_video_anzahl || 0,
      ugc_pro_organic_creator_anzahl: detail.kampagneData.ugc_pro_organic_creator_anzahl || detail.kampagneData.igc_creator_anzahl || 0,
      ugc_pro_organic_bilder_anzahl: detail.kampagneData.ugc_pro_organic_bilder_anzahl || detail.kampagneData.igc_bilder_anzahl || 0,
      ugc_video_paid_video_anzahl: detail.kampagneData.ugc_video_paid_video_anzahl,
      ugc_video_paid_creator_anzahl: detail.kampagneData.ugc_video_paid_creator_anzahl,
      ugc_video_paid_bilder_anzahl: detail.kampagneData.ugc_video_paid_bilder_anzahl,
      ugc_video_organic_video_anzahl: detail.kampagneData.ugc_video_organic_video_anzahl || detail.kampagneData.ugc_video_anzahl || 0,
      ugc_video_organic_creator_anzahl: detail.kampagneData.ugc_video_organic_creator_anzahl || detail.kampagneData.ugc_creator_anzahl || 0,
      ugc_video_organic_bilder_anzahl: detail.kampagneData.ugc_video_organic_bilder_anzahl || detail.kampagneData.ugc_bilder_anzahl || 0,
      influencer_video_anzahl: detail.kampagneData.influencer_video_anzahl,
      influencer_creator_anzahl: detail.kampagneData.influencer_creator_anzahl,
      vor_ort_video_anzahl: detail.kampagneData.vor_ort_video_anzahl,
      vor_ort_creator_anzahl: detail.kampagneData.vor_ort_creator_anzahl,
      vor_ort_videographen_anzahl: detail.kampagneData.vor_ort_videographen_anzahl
    };

    form.dataset.editModeData = JSON.stringify(editModeData);

    if (formData.unternehmen_id) form.dataset.existingUnternehmenId = formData.unternehmen_id;
    if (formData.marke_id) form.dataset.existingMarkeId = formData.marke_id;
    if (formData.auftrag_id) form.dataset.existingAuftragId = formData.auftrag_id;

    form.onsubmit = async (e) => {
      e.preventDefault();
      await handleEditFormSubmit(detail);
    };
  }
}

async function handleEditFormSubmit(detail) {
  console.log('📝 KAMPAGNEDETAIL: Verarbeite Formular-Submission...');

  const form = document.querySelector('form[data-entity-type="kampagne"]');
  if (!form) {
    console.error('❌ Formular nicht gefunden');
    return;
  }

  try {
    const formData = new FormData(form);
    const submitData = {};

    const hiddenSelects = form.querySelectorAll('select[style*="display: none"], select[style*="display:none"]');
    hiddenSelects.forEach(select => {
      if (select.name && (select.name.includes('_ids') || select.name.includes('art_der_kampagne'))) {
        const fieldName = select.name.replace('[]', '');
        const selectedValues = Array.from(select.selectedOptions).map(option => option.value).filter(val => val !== '');
        if (selectedValues.length > 0) {
          submitData[fieldName] = selectedValues;
        }
      }
    });

    for (const [key, value] of formData.entries()) {
      if (key.includes('[]')) {
        const cleanKey = key.replace('[]', '');
        if (!submitData[cleanKey]) submitData[cleanKey] = [];
        submitData[cleanKey].push(value);
      } else {
        if (!submitData.hasOwnProperty(key) || !Array.isArray(submitData[key])) {
          submitData[key] = value;
        }
      }
    }

    const kampagnenartContainer = form.querySelector('#kampagnenart-felder-container');
    if (kampagnenartContainer) {
      kampagnenartContainer.querySelectorAll('input[type="hidden"]').forEach(input => {
        if (input.name && input.value !== undefined) {
          submitData[input.name] = parseInt(input.value, 10) || 0;
        }
      });
    }

    const sumBySuffix = (suffix) => Object.entries(submitData).reduce((sum, [key, val]) => {
      if (!key.endsWith(suffix)) return sum;
      return sum + (parseInt(val, 10) || 0);
    }, 0);
    submitData.videoanzahl = sumBySuffix('_video_anzahl');
    submitData.creatoranzahl = sumBySuffix('_creator_anzahl');

    const result = await window.dataService.updateEntity('kampagne', detail.kampagneId, submitData);

    if (result) {
      try {
        const toArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);
        const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));

        // 1. Plattformen
        if (submitData.plattform_ids !== undefined) {
          const ids = uniq(toArray(submitData.plattform_ids));
          await window.supabase.from('kampagne_plattformen').delete().eq('kampagne_id', detail.kampagneId);
          if (ids.length > 0) {
            await window.supabase.from('kampagne_plattformen').insert(ids.map(id => ({ kampagne_id: detail.kampagneId, plattform_id: id })));
          }
        }

        // 2. Formate
        if (submitData.format_ids !== undefined) {
          const ids = uniq(toArray(submitData.format_ids));
          await window.supabase.from('kampagne_formate').delete().eq('kampagne_id', detail.kampagneId);
          if (ids.length > 0) {
            await window.supabase.from('kampagne_formate').insert(ids.map(id => ({ kampagne_id: detail.kampagneId, format_id: id })));
          }
        }

        // 3. Mitarbeiter
        const mitarbeiter = uniq(toArray(submitData.mitarbeiter_ids));
        const pm = uniq(toArray(submitData.pm_ids));
        const sc = uniq(toArray(submitData.scripter_ids));
        const cu = uniq(toArray(submitData.cutter_ids));
        const cw = uniq(toArray(submitData.copywriter_ids));
        const st = uniq(toArray(submitData.strategie_ids));
        const cs = uniq(toArray(submitData.creator_sourcing_ids));

        await window.supabase.from('kampagne_mitarbeiter').delete().eq('kampagne_id', detail.kampagneId);

        const mitarbeiterRows = [];
        mitarbeiter.forEach(uid => mitarbeiterRows.push({ kampagne_id: detail.kampagneId, mitarbeiter_id: uid, role: 'projektmanager' }));
        pm.forEach(uid => mitarbeiterRows.push({ kampagne_id: detail.kampagneId, mitarbeiter_id: uid, role: 'projektmanager' }));
        sc.forEach(uid => mitarbeiterRows.push({ kampagne_id: detail.kampagneId, mitarbeiter_id: uid, role: 'scripter' }));
        cu.forEach(uid => mitarbeiterRows.push({ kampagne_id: detail.kampagneId, mitarbeiter_id: uid, role: 'cutter' }));
        cw.forEach(uid => mitarbeiterRows.push({ kampagne_id: detail.kampagneId, mitarbeiter_id: uid, role: 'copywriter' }));
        st.forEach(uid => mitarbeiterRows.push({ kampagne_id: detail.kampagneId, mitarbeiter_id: uid, role: 'strategie' }));
        cs.forEach(uid => mitarbeiterRows.push({ kampagne_id: detail.kampagneId, mitarbeiter_id: uid, role: 'creator_sourcing' }));

        if (mitarbeiterRows.length > 0) {
          await window.supabase.from('kampagne_mitarbeiter').insert(mitarbeiterRows);
        }

        // 3b. Paid-Ziele
        const paidZiele = uniq(toArray(submitData.paid_ziele_ids));
        await window.supabase.from('kampagne_paid_ziele').delete().eq('kampagne_id', detail.kampagneId);
        if (paidZiele.length > 0) {
          await window.supabase.from('kampagne_paid_ziele').insert(paidZiele.map(id => ({ kampagne_id: detail.kampagneId, ziel_id: id })));
        }

        // 3c. Organic-Ziele
        const organicZiele = uniq(toArray(submitData.organic_ziele_ids));
        await window.supabase.from('kampagne_organic_ziele').delete().eq('kampagne_id', detail.kampagneId);
        if (organicZiele.length > 0) {
          await window.supabase.from('kampagne_organic_ziele').insert(organicZiele.map(id => ({ kampagne_id: detail.kampagneId, ziel_id: id })));
        }

        // 4. Ansprechpartner
        if (submitData.ansprechpartner_ids !== undefined) {
          const ids = uniq(toArray(submitData.ansprechpartner_ids));
          await window.supabase.from('ansprechpartner_kampagne').delete().eq('kampagne_id', detail.kampagneId);
          if (ids.length > 0) {
            await window.supabase.from('ansprechpartner_kampagne').insert(ids.map(id => ({ kampagne_id: detail.kampagneId, ansprechpartner_id: id })));
          }
        }
      } catch (e) {
        console.warn('⚠️ KAMPAGNEDETAIL: Junction Table Updates konnten nicht vollständig durchgeführt werden', e);
      }

      try {
        await transferKampagneDataToAuftragsdetails(submitData, detail.kampagneId, detail.kampagneData?.auftrag_id);
      } catch (e) {
        console.warn('⚠️ KAMPAGNEDETAIL: Auftragsdetails-Transfer fehlgeschlagen', e);
      }

      showSuccessMessage('Kampagne erfolgreich aktualisiert!');

      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'kampagne', action: 'updated', id: detail.kampagneId }
      }));

      setTimeout(() => {
        window.navigateTo(`/kampagne/${detail.kampagneId}`);
      }, 1500);
    }
  } catch (error) {
    console.error('❌ Fehler beim Aktualisieren der Kampagne:', error);
    showErrorMessage('Ein unerwarteter Fehler ist aufgetreten.');
  }
}

export function showSuccessMessage(message) {
  const alertDiv = document.createElement('div');
  alertDiv.className = 'alert alert-success';
  alertDiv.textContent = message;
  const form = document.getElementById('kampagne-form');
  if (form) {
    form.parentNode.insertBefore(alertDiv, form);
    setTimeout(() => alertDiv.remove(), 5000);
  }
}

export function showErrorMessage(message) {
  const alertDiv = document.createElement('div');
  alertDiv.className = 'alert alert-danger';
  alertDiv.textContent = message;
  const form = document.getElementById('kampagne-form');
  if (form) {
    form.parentNode.insertBefore(alertDiv, form);
    setTimeout(() => alertDiv.remove(), 5000);
  }
}
