// Anlegen aus dem Create-Drawer: ohne Datei der bisherige Liky-Weg,
// mit Datei der Skript-Upload (ADR 0073).

import { skripteService } from './SkripteService.js';
import { buildReferenzVideoPayload } from './strategieVorlage.js';
import { resolveSkriptCreatePayload, personaIdFuerSkript } from './skriptCreateKontext.js';
export async function submitSkriptCreate(drawer) {
  const unternehmenId = drawer.el('unternehmen')?.value;
  const strategieId = drawer.el('konzept')?.value;
  const itemId = drawer.el('videoidee')?.value;
  const file = drawer.datei();

  if (!unternehmenId) {
    window.toastSystem?.show('Bitte ein Unternehmen wählen', 'error');
    return;
  }
  if (!strategieId) {
    const ohneKonzept = drawer.prefill?.briefing_id
      && !drawer.konzepte.some((k) => k.briefing_id === drawer.prefill.briefing_id);
    window.toastSystem?.show(
      ohneKonzept ? 'Diese Linie hat noch kein Konzept.' : 'Bitte ein Konzept wählen',
      'error'
    );
    return;
  }
  if (!itemId && !file) {
    window.toastSystem?.show('Bitte eine freigegebene Videoidee wählen', 'error');
    return;
  }

  const basis = itemId ? drawer.items.find((i) => i.id === itemId) : null;
  if (itemId && !basis) {
    window.toastSystem?.show('Die gewählte Videoidee ist nicht mehr verfügbar', 'error');
    return;
  }

  const btn = drawer.el('submit');
  const label = btn?.querySelector('.mdc-btn__label');
  if (btn) btn.disabled = true;

  try {
    if (file) {
      if (label) label.textContent = uploadArtText(file);
      const vorbereitet = await payloadFuerUpload(drawer, basis);
      const skript = await skripteService.createSkriptAusUpload({
        file,
        payload: vorbereitet.payload,
        item: vorbereitet.item
      });
      return { id: skript.id, meldung: 'Skript aus der Datei angelegt' };
    }

    const voll = await skripteService.loadStrategieItem(itemId);
    const item = { ...basis, ...(voll || {}) };
    const videoIdee = (item.beschreibung || item.kurzbeschreibung || '').trim();
    if (!videoIdee) throw new Error('Die Videoidee hat keine Beschreibung');

    const personaId = personaIdFuerSkript(item);
    const produktIds = await skripteService.loadAcceptedProduktIds(personaId);
    const payload = {
      ...resolveSkriptCreatePayload(item, { produktIds }),
      produktion_id: drawer.prefill?.produktion_id || item.strategie?.produktion_id || null,
      referenz_video: buildReferenzVideoPayload({
        strategieItemId: item.id,
        url: item.video_link,
        transkript: item.transkript,
        beschreibung: item.beschreibung || item.kurzbeschreibung,
        caption: item.caption,
        platform: item.plattform
      })
    };

    const stub = await skripteService.createSkriptStub(payload);
    return { id: stub.id, meldung: 'Skript angelegt – Liky stellt Rückfragen' };
  } catch (err) {
    window.toastSystem?.show(err.message || 'Skript konnte nicht angelegt werden', 'error');
    if (btn) btn.disabled = false;
    if (label) label.textContent = 'Skript erstellen';
  }
}

function uploadArtText(file) {
  return /\.pdf$/i.test(file.name) ? 'PDF wird gelesen…' : 'Word wird gelesen…';
}

async function payloadFuerUpload(drawer, basis) {
  if (!basis) {
    const konzept = drawer.konzepte.find((k) => k.id === drawer.el('konzept')?.value);
    if (!konzept) throw new Error('Bitte ein Konzept wählen');
    return {
      item: null,
      payload: {
        unternehmen_id: konzept.unternehmen_id,
        marke_id: konzept.marke_id || null,
        kampagne_id: konzept.kampagne_id || null,
        produktion_id: drawer.prefill?.produktion_id || konzept.produktion_id || null,
        briefing_id: konzept.briefing_id || null
      }
    };
  }
  const voll = await skripteService.loadStrategieItem(basis.id);
  const item = { ...basis, ...(voll || {}) };
  const personaId = personaIdFuerSkript(item);
  const produktIds = await skripteService.loadAcceptedProduktIds(personaId);
  return {
    item,
    payload: {
      ...resolveSkriptCreatePayload(item, { produktIds }),
      produktion_id: drawer.prefill?.produktion_id || item.strategie?.produktion_id || null
    }
  };
}
