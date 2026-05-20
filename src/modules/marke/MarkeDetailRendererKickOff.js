// MarkeDetailRendererKickOff.js
// Kick-Off Tab mit Paid/Organic Switcher

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
        ${!isKunde ? `<a href="/kickoff" class="btn btn-primary" onclick="event.preventDefault(); window.navigateTo('/kickoff')">Kick-Off erstellen</a>` : ''}
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
          ${!isKunde ? `<a href="/kickoff" class="btn btn-primary" onclick="event.preventDefault(); window.navigateTo('/kickoff')">${typeLabel} Kick-Off erstellen</a>` : ''}
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
        ${!isKunde ? `<a href="/kickoff" class="btn btn-sm btn-secondary" onclick="event.preventDefault(); window.navigateTo('/kickoff')" style="margin-left: 1rem;">Bearbeiten</a>` : ''}
      </div>
    </div>
  `;
}
