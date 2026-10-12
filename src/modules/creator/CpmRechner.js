import { berechnePreisAusViews, DEFAULT_TKP } from '../creator-auswahl/CreatorAuswahlTemplates.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { openDrawer } from './creatorDrawer.js';
import { formatFollowerShort, searchTokens } from './creatorProfil.js';

const DRAWER_ID = 'cpm-rechner-drawer';

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Reichweite -> Preis, gleiche Rechnung wie in der Sourcing-Liste */
export function priceFromViews(views, tkp = DEFAULT_TKP) {
  const n = Number(views);
  if (!Number.isFinite(n) || n <= 0) return null;
  return berechnePreisAusViews(n, tkp);
}

/** Preis -> TKP, die Gegenrichtung */
export function cpmFromPrice(price, views) {
  const reach = Number(views);
  const amount = Number(price);
  if (!Number.isFinite(reach) || reach <= 0 || !Number.isFinite(amount)) return null;
  return amount / (reach / 1000);
}

export function openCpmRechner() {
  const esc = (value) => window.validatorSystem?.sanitizeHtml?.(String(value ?? '')) ?? String(value ?? '');

  const { body, close } = openDrawer({
    id: DRAWER_ID,
    title: 'CPM-Rechner',
    subtitle: `Reichweite, Preis und TKP – Standard ${DEFAULT_TKP} € TKP`,
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
        <label for="cpm-preis">Preis in Euro</label>
        <input id="cpm-preis" type="number" min="0" step="0.01" class="form-input" />
        <span class="form-hint" id="cpm-ergebnis"></span>
      </div>
      <div class="form-field">
        <label for="cpm-creator-search-input">Creator als Quelle</label>
        <div class="searchable-select-container">
          ${SearchInput.render('cpm-creator', { placeholder: 'Name oder Handle...' })}
          <div id="cpm-treffer" class="searchable-select-dropdown"></div>
        </div>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--secondary" id="cpm-schliessen">Schließen</button>
      </div>
    `
  });

  const fenster = body.querySelector('#cpm-fenster');
  const views = body.querySelector('#cpm-views');
  const preis = body.querySelector('#cpm-preis');
  const out = body.querySelector('#cpm-ergebnis');
  const treffer = body.querySelector('#cpm-treffer');
  let quelle = null;

  const zeichne = (quellfeld) => {
    const reach = Number(views.value);
    if (quellfeld === 'views') {
      const price = priceFromViews(reach);
      if (price != null) preis.value = price.toFixed(2);
    }
    const cpm = cpmFromPrice(preis.value, reach);
    out.textContent = cpm == null
      ? ''
      : `${money(preis.value)} € bei ${Number(reach).toLocaleString('de-DE')} Views = ${money(cpm)} € TKP`;
  };

  views.addEventListener('input', () => zeichne('views'));
  preis.addEventListener('input', () => zeichne('preis'));
  body.querySelector('#cpm-schliessen').addEventListener('click', close);

  // Reichweite aus den gespeicherten Reels-Schnitten des Creators
  const uebernehmeQuelle = () => {
    if (!quelle) return;
    const wert = fenster.value === '30' ? quelle.ig_views_30 : quelle.ig_views_8;
    if (wert == null) {
      out.textContent = `Für ${quelle.name} liegt kein ${fenster.value}er-Schnitt vor`;
      return;
    }
    views.value = Math.round(wert);
    zeichne('views');
  };
  fenster.addEventListener('change', uebernehmeQuelle);

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
