/**
 * Rendert den Bezahlt-Toggle für eine Rechnung in der Tabellenansicht.
 * @param {object} rechnung - Das Rechnungs-Objekt mit mindestens { id, status }
 * @param {boolean} canEdit - Ob der aktuelle User den Status ändern darf
 * @returns {string} HTML-String mit Toggle-Switch
 */
export function renderBezahltToggle(rechnung, canEdit) {
  const checked = rechnung?.status === 'Bezahlt' ? 'checked' : '';
  const disabled = canEdit ? '' : 'disabled';
  const label = `Bezahlt-Status für ${rechnung?.rechnung_nr || rechnung?.id || 'Rechnung'}`;

  return `
    <label class="toggle-switch rechnung-bezahlt-toggle-wrapper">
      <input type="checkbox"
        class="rechnung-bezahlt-toggle"
        data-id="${rechnung?.id || ''}"
        aria-label="${label}"
        ${checked}
        ${disabled}>
      <span class="toggle-slider"></span>
    </label>
  `;
}
