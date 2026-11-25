// kampagneAbschluss.js
// Manuelles Abschließen einer Kampagne aus dem Aktionsmenü.
// Der Client schreibt nur kampagne.abschluss_manuell. is_completed leitet die Datenbank ab
// (manuell ODER alle Videos freigegeben), damit der Haken nicht beim nächsten Video verschwindet.

const ACTION_ID = 'abschliessen';

/**
 * Optionen für actionBuilder.create('kampagne', id, user, options) je Kampagne.
 * - nicht manuell abgeschlossen: „Als abgeschlossen markieren“
 * - manuell abgeschlossen: „Wieder öffnen“
 * - über die Freigabe abgeschlossen: ausgeblendet, ein Öffnen würde der nächste Refresh rückgängig machen
 * - Flags nicht geladen: ausgeblendet, der Zustand ist nicht bekannt
 *
 * @param {{ is_completed?: boolean, abschluss_manuell?: boolean }} kampagne
 */
export function kampagneAbschlussOptions(kampagne) {
  const manuell = kampagne?.abschluss_manuell;
  const completed = kampagne?.is_completed;
  const unbekannt = manuell == null || completed == null;
  const ueberFreigabe = completed === true && manuell !== true;

  return {
    actionStates: unbekannt || ueberFreigabe
      ? { [ACTION_ID]: { mode: 'hidden', title: '' } }
      : {},
    actionOverrides: manuell === true
      ? { [ACTION_ID]: { label: 'Wieder öffnen' } }
      : {},
    // Zielwert am Eintrag: bleibt auch bei veralteter Liste idempotent.
    dataset: (action) => (action.id === ACTION_ID
      ? { abschluss: manuell === true ? 'false' : 'true' }
      : null)
  };
}

/**
 * Setzt abschluss_manuell auf den Zielwert und meldet die Änderung an die Listen.
 * @param {string} kampagneId
 * @param {boolean} abgeschlossen
 */
export async function setKampagneAbschluss(kampagneId, abgeschlossen) {
  try {
    const { data, error } = await window.supabase
      .from('kampagne')
      .update({ abschluss_manuell: abgeschlossen })
      .eq('id', kampagneId)
      .select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Keine Berechtigung oder Kampagne nicht gefunden');

    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'kampagne', action: 'updated', id: kampagneId, field: 'abschluss_manuell', value: abgeschlossen }
    }));
    window.toastSystem?.show(
      abgeschlossen ? 'Kampagne als abgeschlossen markiert' : 'Kampagne wieder geöffnet',
      'success'
    );
  } catch (err) {
    console.error('setKampagneAbschluss fehlgeschlagen', err);
    window.toastSystem?.show('Aktualisierung fehlgeschlagen', 'error');
  }
}
