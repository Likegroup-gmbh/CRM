// Hinweise nach einem Skript-Upload: PDF-Wortlaut prüfen, Hook-Abweichung,
// und die Videoidee nachziehen, solange keine am Skript hängt.

import { escapeHtml } from '../SkripteUtils.js';
import { skripteService } from '../SkripteService.js';

export function uploadHinweisHtml(skript) {
  if (!skript || !window.isInternal?.()) return '';
  const kontext = skript.prompt_kontext || {};
  const teile = [];
  if (kontext.upload_status === 'lesen') {
    teile.push('<p class="skripte-hint" data-upload-lesen>Liky liest die Datei. Die Zellen füllen sich gleich.</p>');
  }
  if (kontext.upload_status === 'fehler') {
    teile.push(`<p class="skripte-hint skripte-hint--warnung">${escapeHtml(kontext.upload_fehler || 'Die Datei konnte nicht gelesen werden.')}</p>`);
  }
  if (kontext.upload_pruefen && kontext.upload_status !== 'lesen') {
    teile.push('<p class="skripte-hint skripte-hint--warnung" data-upload-pruefen>Von Liky gelesen, bitte Wortlaut prüfen.</p>');
  }
  if (kontext.upload_hook_weicht) {
    teile.push('<p class="skripte-hint skripte-hint--warnung">Der Hook weicht vom gesperrten Hook der Videoidee ab. Liky ändert ihn nicht.</p>');
  }
  if (!skript.strategie_item_id && skript.herkunft === 'hochgeladen' && skript.briefing_id) {
    teile.push(`
      <p class="skripte-hint" data-upload-videoidee>
        Noch keine Videoidee.
        <select class="form-input" data-videoidee-setzen aria-label="Videoidee setzen" disabled>
          <option value="">Videoideen laden…</option>
        </select>
      </p>`);
  }
  return teile.join('');
}

export function bindUploadHinweis(view, el) {
  const select = el.querySelector('[data-videoidee-setzen]');
  if (select && !view.isReadonly) fuelleVideoideen(view, select);
  if (view.skript?.prompt_kontext?.upload_status === 'lesen') beobachtePdf(view);
}

async function fuelleVideoideen(view, select) {
  try {
    const strategieId = await skripteService.loadKonzeptIdVonBriefing(view.skript.briefing_id);
    const ideen = strategieId
      ? await skripteService.loadFreigegebeneVideoideen({
        unternehmenId: view.skript.unternehmen_id,
        strategieId,
        nurFreigabe: false
      })
      : [];
    select.innerHTML = `<option value="">Videoidee setzen…</option>`
      + ideen.map((item) => {
        const text = (item.beschreibung || item.kurzbeschreibung || 'Videoidee').replace(/\s+/g, ' ').trim();
        return `<option value="${escapeHtml(item.id)}">${escapeHtml(text.slice(0, 80))}</option>`;
      }).join('');
    select.disabled = !ideen.length;
    select.addEventListener('change', async () => {
      const item = ideen.find((eintrag) => eintrag.id === select.value);
      if (!item) return;
      select.disabled = true;
      try {
        await skripteService.setzeSkriptVideoidee(view.skript, item);
        const fresh = await skripteService.loadSkript(view.skript.id);
        if (fresh) view.skript = fresh;
        view.renderDoc();
        window.toastSystem?.success('Videoidee gesetzt');
      } catch (err) {
        select.disabled = false;
        window.toastSystem?.error(err.message);
      }
    });
  } catch (err) {
    select.innerHTML = '<option value="">Videoideen nicht geladen</option>';
    console.warn('Videoideen für den Upload:', err.message);
  }
}

function beobachtePdf(view) {
  if (view._uploadPdfTimer) return;
  const start = Date.now();
  view._uploadPdfTimer = setInterval(async () => {
    if (!view.skript?.id || Date.now() - start > 3 * 60 * 1000) {
      clearInterval(view._uploadPdfTimer);
      view._uploadPdfTimer = null;
      return;
    }
    try {
      const fresh = await skripteService.loadSkript(view.skript.id);
      if (!fresh || fresh.prompt_kontext?.upload_status === 'lesen') return;
      clearInterval(view._uploadPdfTimer);
      view._uploadPdfTimer = null;
      view.skript = fresh;
      view.renderDoc();
    } catch (_) { /* nächster Tick */ }
  }, 2000);
}
