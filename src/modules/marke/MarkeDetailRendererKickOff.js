// MarkeDetailRendererKickOff.js
// Kick-Off Tab mit Paid/Organic Switcher + Inline-Erstellung

export function renderKickOff(detail) {
  const availableCount = Object.values(detail.kickoffsByType).filter(Boolean).length;
  const activeKickoff = detail.kickoffsByType[detail.activeKickoffType];
  const activeMarkenwerte = detail.kickoffMarkenwerteByType[detail.activeKickoffType] || [];
  const typeLabel = detail.activeKickoffType === 'paid' ? 'Paid' : 'Organic';
  const isKunde = window.isKunde();

  if (availableCount === 0) {
    if (!detail._kickoffLoaded) {
      return `<div class="empty-state"><p>Laden...</p></div>`;
    }
    return `
      <div class="empty-state">
        <h3>Kein Kick-Off vorhanden</h3>
        <p>Es wurde noch kein Brand Kick-Off für diese Marke erstellt.</p>
        ${!isKunde ? `<button type="button" class="btn btn-primary kickoff-detail-create-btn">Kick-Off anlegen</button>` : ''}
      </div>
    `;
  }

  const formatValue = (value) => {
    if (!value) return '<span class="text-muted">-</span>';
    return detail.sanitize(value).replace(/\n/g, '<br>');
  };

  const markenwerteHtml = activeMarkenwerte.length > 0
    ? activeMarkenwerte.map(mw => `<span class="tag tag--markenwert">${detail.sanitize(mw.name)}</span>`).join(' ')
    : '<span class="text-muted">-</span>';

  const typeSwitcher = `
    <div class="tab-navigation kickoff-type-switcher">
      <button type="button" class="tab-button ${detail.activeKickoffType === 'organic' ? 'active' : ''} kickoff-type-btn" data-kickoff-type="organic">Organic</button>
      <button type="button" class="tab-button ${detail.activeKickoffType === 'paid' ? 'active' : ''} kickoff-type-btn" data-kickoff-type="paid">Paid</button>
    </div>
  `;

  if (!activeKickoff) {
    return `
      <div class="detail-section">
        ${typeSwitcher}
        <div class="empty-state">
          <h3>Kein ${typeLabel} Kick-Off vorhanden</h3>
          <p>Für den Typ ${typeLabel} wurde noch kein Kick-Off erstellt.</p>
          ${!isKunde ? `<button type="button" class="btn btn-primary kickoff-detail-create-btn" data-kickoff-type="${detail.activeKickoffType}">${typeLabel} Kick-Off anlegen</button>` : ''}
        </div>
      </div>
    `;
  }

  return `
    <div class="detail-section">
      ${typeSwitcher}
      <div class="data-table-container">
        <table class="data-table kickoff-table">
          <thead>
            <tr>
              <th style="width: 30%;">Kategorie</th>
              <th>Inhalt</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1. Brand-Essenz</td>
              <td>${formatValue(activeKickoff.brand_essenz)}</td>
            </tr>
            <tr>
              <td>2. Mission / Zweck</td>
              <td>${formatValue(activeKickoff.mission)}</td>
            </tr>
            <tr>
              <td>3. Markenwerte</td>
              <td>${markenwerteHtml}</td>
            </tr>
            <tr>
              <td>4. Zielgruppe</td>
              <td>${formatValue(activeKickoff.zielgruppe)}</td>
            </tr>
            <tr>
              <td>5. Zielgruppen-Mindset</td>
              <td>${formatValue(activeKickoff.zielgruppen_mindset)}</td>
            </tr>
            <tr>
              <td>6. Marken-USP</td>
              <td>${formatValue(activeKickoff.marken_usp)}</td>
            </tr>
            <tr>
              <td>7. Tonalität &amp; Sprachstil</td>
              <td>${formatValue(activeKickoff.tonalitaet_sprachstil)}</td>
            </tr>
            <tr>
              <td>8. Content-Charakter</td>
              <td>${formatValue(activeKickoff.content_charakter)}</td>
            </tr>
            <tr>
              <td>9. Do's &amp; Don'ts</td>
              <td>${formatValue(activeKickoff.dos_donts)}</td>
            </tr>
            <tr>
              <td>10. Rechtliche Leitplanken</td>
              <td>${formatValue(activeKickoff.rechtliche_leitplanken)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="kickoff-meta">
        <small class="text-muted">
          Typ: ${typeLabel} | Zuletzt aktualisiert: ${detail.formatDate(activeKickoff.updated_at)}
        </small>
        ${!isKunde ? `<a href="/kickoff/${activeKickoff.id}" class="btn btn-sm btn-secondary" onclick="event.preventDefault(); window.navigateTo('/kickoff/${activeKickoff.id}')" style="margin-left: 1rem;">Bearbeiten</a>` : ''}
      </div>
    </div>
  `;
}

export function bindKickOffCreateButton(detail) {
  const btn = document.querySelector('.kickoff-detail-create-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const presetType = btn.dataset.kickoffType;
    let selectedType = presetType;

    if (!selectedType) {
      const { KickOffTypeDialog } = await import('../kickoff/KickOffTypeDialog.js');
      selectedType = await KickOffTypeDialog.show();
      if (!selectedType) return;
    }

    const container = btn.closest('.empty-state') || btn.closest('.detail-section');
    if (!container) return;

    const kickoffFormHtml = window.formSystem.renderFormOnly('kickoff_embedded');
    container.innerHTML = `
      <div class="kickoff-panel-header">
        <h3 class="kickoff-panel-header__title">Kick-Off anlegen <span class="kickoff-panel-header__badge">${selectedType === 'organic' ? 'Organic' : 'Paid'}</span></h3>
      </div>
      <div class="form-page" id="kickoff-inline-form-wrapper">
        ${kickoffFormHtml}
      </div>
      <div class="form-actions" style="margin-top: 1rem; padding: 0 1rem;">
        <button type="button" class="mdc-btn mdc-btn--cancel" id="kickoff-inline-cancel">Abbrechen</button>
        <button type="button" class="mdc-btn mdc-btn--create" id="kickoff-inline-save">Kick-Off speichern</button>
      </div>
    `;

    window.formSystem.bindFormEvents('kickoff_embedded', null);

    const inlineForm = container.querySelector('form');
    if (inlineForm) {
      inlineForm.onsubmit = (e) => e.preventDefault();
      const submitRow = inlineForm.querySelector('.form-actions');
      if (submitRow) submitRow.style.display = 'none';
    }

    document.getElementById('kickoff-inline-cancel')?.addEventListener('click', () => {
      if (detail.renderContent) detail.renderContent();
    });

    document.getElementById('kickoff-inline-save')?.addEventListener('click', async () => {
      const saveBtn = document.getElementById('kickoff-inline-save');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Speichert...';
      }

      try {
        const kickoffForm = container.querySelector('form');
        if (!kickoffForm) throw new Error('Formular nicht gefunden');

        const kickoffData = window.formSystem.collectSubmitData(kickoffForm);

        const validation = window.validatorSystem.validateForm(kickoffData, {
          brand_essenz: { type: 'text', minLength: 2, required: true },
          mission: { type: 'text', required: true },
          zielgruppe: { type: 'text', required: true },
          marken_usp: { type: 'text', required: true },
          tonalitaet_sprachstil: { type: 'text', required: true }
        });

        if (!validation.isValid) {
          window.toastSystem?.show('Bitte alle Pflichtfelder ausfüllen', 'error');
          if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Kick-Off speichern'; }
          return;
        }

        const insertData = {
          kickoff_type: selectedType,
          brand_essenz: kickoffData.brand_essenz || '',
          mission: kickoffData.mission || '',
          zielgruppe: kickoffData.zielgruppe || '',
          zielgruppen_mindset: kickoffData.zielgruppen_mindset || '',
          marken_usp: kickoffData.marken_usp || '',
          tonalitaet_sprachstil: kickoffData.tonalitaet_sprachstil || '',
          content_charakter: kickoffData.content_charakter || '',
          dos_donts: kickoffData.dos_donts || '',
          rechtliche_leitplanken: kickoffData.rechtliche_leitplanken || '',
          marke_id: detail.data?.id || null,
          unternehmen_id: detail.data?.id ? null : null,
          created_by: window.currentUser?.id || null
        };

        const { data: kickoffResult, error } = await window.supabase
          .from('marke_kickoff')
          .insert([insertData])
          .select()
          .single();

        if (error) throw error;

        // Markenwerte Junction
        const markenwerte = kickoffData.markenwerte_ids;
        if (markenwerte && Array.isArray(markenwerte) && markenwerte.length > 0) {
          const junctionRows = markenwerte.slice(0, 3).map(markenwertId => ({
            kickoff_id: kickoffResult.id,
            markenwert_id: markenwertId
          }));
          await window.supabase.from('marke_kickoff_markenwerte').insert(junctionRows);
        }

        window.toastSystem?.show('Kick-Off erfolgreich erstellt!', 'success');
        
        if (detail.loadData) {
          await detail.loadData(detail.data.id);
          if (detail.renderContent) detail.renderContent();
        }
      } catch (err) {
        console.error('❌ Kick-Off Speicherfehler:', err);
        window.toastSystem?.show('Fehler beim Speichern: ' + err.message, 'error');
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Kick-Off speichern'; }
      }
    });
  });
}
