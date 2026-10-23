import { berechnePreisAusViews, DEFAULT_TKP } from '../creator-auswahl/castingPreisZellen.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { openDrawer } from './creatorDrawer.js';
import { formatFollowerShort, searchTokens } from './creatorProfil.js';

const DRAWER_ID = 'cpm-rechner-drawer';
const FELDER = ['views', 'tkp', 'preis'];

/** Leer und 0 rechnen nicht mit. */
function positiv(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Die beiden zuletzt angefassten Felder bleiben stehen, das dritte wird
 * neu gerechnet. Dasselbe Feld noch einmal zu aendern laesst das
 * Ergebnis-Feld gleich. `zuletzt` ist aeltestes zuerst.
 */
export function naechstesErgebnis(zuletzt, feld) {
  const liste = zuletzt.filter((eintrag) => eintrag !== feld);
  liste.push(feld);
  if (liste.length < 2) return { zuletzt: liste, ergebnis: null };
  const zwei = liste.slice(-2);
  return {
    zuletzt: zwei,
    ergebnis: FELDER.find((name) => !zwei.includes(name))
  };
}

/** Das Ergebnis-Feld aus den beiden Eingaben. null leert das Ergebnis. */
export function rechneCpmFeld(ergebnis, werte) {
  const views = positiv(werte.views);
  const tkp = positiv(werte.tkp);
  const preis = positiv(werte.preis);
  if (ergebnis === 'preis') {
    if (views == null || tkp == null) return null;
    return berechnePreisAusViews(views, tkp);
  }
  if (ergebnis === 'tkp') {
    if (views == null || preis == null) return null;
    return Math.round((preis / (views / 1000)) * 100) / 100;
  }
  if (ergebnis === 'views') {
    if (preis == null || tkp == null) return null;
    return Math.round((preis / tkp) * 1000);
  }
  return null;
}

export function openCpmRechner() {
  const esc = (value) => window.validatorSystem?.sanitizeHtml?.(String(value ?? '')) ?? String(value ?? '');

  const { body, close } = openDrawer({
    id: DRAWER_ID,
    title: 'CPM-Rechner',
    subtitle: 'Reichweite, Preis und TKP',
    body: `
      <div class="form-field">
        <label for="cpm-fenster">Fenster</label>
        <select id="cpm-fenster" class="form-input">
          <option value="8">Schnitt der letzten 8 Reels</option>
          <option value="30">Schnitt der letzten 30 Reels</option>
        </select>
      </div>
      <div class="form-field">
        <label for="cpm-views">Reichweite</label>
        <input id="cpm-views" type="number" min="0" step="1" class="form-input" placeholder="Views" />
      </div>
      <div class="form-field">
        <label for="cpm-tkp">TKP in Euro</label>
        <input id="cpm-tkp" type="number" min="0" step="0.01" class="form-input" value="${DEFAULT_TKP}" />
      </div>
      <div class="form-field">
        <label for="cpm-preis">Preis in Euro</label>
        <input id="cpm-preis" type="number" min="0" step="0.01" class="form-input" />
      </div>
      <div class="form-field">
        <label for="cpm-creator-search-input">Creator als Quelle</label>
        <div class="searchable-select-container">
          ${SearchInput.render('cpm-creator', { placeholder: 'Name oder Handle...' })}
          <div id="cpm-treffer" class="searchable-select-dropdown"></div>
        </div>
        <span class="form-hint" id="cpm-quelle-hinweis" hidden></span>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--secondary" id="cpm-schliessen">Schließen</button>
      </div>
    `
  });

  const fenster = body.querySelector('#cpm-fenster');
  const views = body.querySelector('#cpm-views');
  const tkp = body.querySelector('#cpm-tkp');
  const preis = body.querySelector('#cpm-preis');
  const hinweis = body.querySelector('#cpm-quelle-hinweis');
  const treffer = body.querySelector('#cpm-treffer');
  const felder = { views, tkp, preis };
  // Der Startwert 25 € gilt als schon gesetzt.
  let zuletzt = ['tkp'];
  let quelle = null;

  const werte = () => ({
    views: views.value,
    tkp: tkp.value,
    preis: preis.value
  });

  const schreibe = (feld, wert) => {
    const input = felder[feld];
    if (wert == null) {
      input.value = '';
      return;
    }
    input.value = feld === 'views' ? String(wert) : wert.toFixed(2);
  };

  const zeigeHinweis = (text) => {
    hinweis.hidden = !text;
    hinweis.textContent = text || '';
  };

  const wendeAn = (feld) => {
    const next = naechstesErgebnis(zuletzt, feld);
    zuletzt = next.zuletzt;
    if (!next.ergebnis) return;
    schreibe(next.ergebnis, rechneCpmFeld(next.ergebnis, werte()));
    zeigeHinweis('');
  };

  // Ein Mitarbeiter waehlt einen Creator als Reichweiten-Quelle.
  // Gesetzt wird nur die Reichweite, der Preis rechnet neu, der TKP bleibt.
  const uebernehmeQuelle = () => {
    if (!quelle) return;
    const wert = fenster.value === '30' ? quelle.ig_views_30 : quelle.ig_views_8;
    if (wert == null) {
      zeigeHinweis(`Für ${quelle.name} liegt kein ${fenster.value}er-Schnitt vor`);
      return;
    }
    views.value = String(Math.round(Number(wert)));
    zuletzt = ['tkp', 'views'];
    schreibe('preis', rechneCpmFeld('preis', werte()));
    zeigeHinweis('');
  };

  views.addEventListener('input', () => wendeAn('views'));
  tkp.addEventListener('input', () => wendeAn('tkp'));
  preis.addEventListener('input', () => wendeAn('preis'));
  fenster.addEventListener('change', uebernehmeQuelle);
  body.querySelector('#cpm-schliessen').addEventListener('click', close);

  const suchen = async (term) => {
    const tokens = searchTokens(term);
    if (!tokens.length || !window.supabase) {
      treffer.classList.remove('show');
      treffer.innerHTML = '';
      return;
    }
    let query = window.supabase
      .from('creator')
      .select('id, vorname, nachname, instagram_follower')
      .limit(8);
    for (const token of tokens) {
      const safe = token.replace(/[%_,.()]/g, '');
      if (!safe) continue;
      query = query.or(`vorname.ilike.${safe}%,nachname.ilike.${safe}%,instagram.ilike.${safe}%,instagram.ilike.@${safe}%`);
    }
    const { data } = await query;
    const rows = data || [];
    treffer.innerHTML = rows.length
      ? rows.map((row) => `
          <div class="searchable-select-item" data-id="${esc(row.id)}">
            <span class="searchable-select-item-label">${esc(`${row.vorname || ''} ${row.nachname || ''}`.trim())}</span>
            <span class="searchable-select-item-subtitle">${formatFollowerShort(row.instagram_follower) || '–'} Follower</span>
          </div>`).join('')
      : '<div class="searchable-select-empty">Kein Creator gefunden</div>';
    treffer.classList.add('show');
  };

  treffer.addEventListener('click', async (event) => {
    const option = event.target.closest('[data-id]');
    if (!option) return;
    const name = option.querySelector('.searchable-select-item-label')?.textContent?.trim() || '';
    const input = body.querySelector('#cpm-creator-search-input');
    if (input) input.value = name;
    treffer.classList.remove('show');

    // Die Reels-Schnitte liegen an den Sourcing-Eintraegen, nicht am Creator
    const { data } = await window.supabase
      .from('creator_auswahl_items')
      .select('ig_views_8, ig_views_30, created_at')
      .eq('creator_id', option.dataset.id)
      .order('created_at', { ascending: false })
      .limit(1);
    const row = data?.[0] || {};
    quelle = { name, ig_views_8: row.ig_views_8 ?? null, ig_views_30: row.ig_views_30 ?? null };
    uebernehmeQuelle();
  });

  SearchInput.bind('cpm-creator', (value) => suchen(value));
}

export function bindCpmRechner() {
  document.getElementById('btn-cpm-rechner')?.addEventListener('click', (event) => {
    event.preventDefault();
    openCpmRechner();
  });
}
