import { creatorAuswahlService } from '../creator-auswahl/CreatorAuswahlService.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { openDrawer } from './creatorDrawer.js';

const DRAWER_ID = 'creator-casting-drawer';
const LETZTE_KEY = 'creator-casting-letzte-kampagne';

// Zuletzt gewählte Kampagne gilt für die laufende Browser-Sitzung.
export function letzteKampagne() {
  try {
    const value = JSON.parse(sessionStorage.getItem(LETZTE_KEY) || 'null');
    return value?.id ? value : null;
  } catch {
    return null;
  }
}

export function merkeKampagne(id, name) {
  try {
    sessionStorage.setItem(LETZTE_KEY, JSON.stringify({ id, name: name || '' }));
  } catch {
    // Speicher nicht verfügbar
  }
}

export function openCastingListeId() {
  return window.__openCastingListeId || null;
}

export function setOpenCastingListe(listeId) {
  window.__openCastingListeId = listeId || null;
}

export async function addCreatorToListe(listeId, creator) {
  const { data: existing } = await window.supabase
    .from('creator_auswahl_items')
    .select('id')
    .eq('creator_auswahl_id', listeId)
    .eq('creator_id', creator.id)
    .limit(1);
  if (existing?.length) {
    window.toastSystem?.show('Dieser Creator ist schon im Casting', 'info');
    return existing[0];
  }
  const name = `${creator.vorname || ''} ${creator.nachname || ''}`.trim();
  return creatorAuswahlService.createItem({
    creator_auswahl_id: listeId,
    creator_id: creator.id,
    name: name || null,
    link_instagram: creator.instagram || null,
    link_tiktok: creator.tiktok || null,
    email: creator.mail || null,
    telefon: creator.telefonnummer || null,
    wohnort: creator.lieferadresse_stadt || null
  });
}

async function ensureListeForKampagne(kampagneId) {
  const { data: listen } = await window.supabase
    .from('creator_auswahl')
    .select('id')
    .eq('kampagne_id', kampagneId)
    .limit(1);
  if (listen?.length) return listen[0].id;

  const { data: kampagne } = await window.supabase
    .from('kampagne')
    .select('id, kampagnenname, briefing_id, unternehmen_id, marke_id')
    .eq('id', kampagneId)
    .single();
  if (!kampagne?.briefing_id) {
    throw new Error('Dieser Kampagne fehlt ein finalisiertes Briefing. Ohne Briefing kann kein Casting angelegt werden.');
  }
  const liste = await creatorAuswahlService.createListe({
    name: kampagne.kampagnenname || 'Casting',
    kampagne_id: kampagne.id,
    briefing_id: kampagne.briefing_id,
    unternehmen_id: kampagne.unternehmen_id || null,
    marke_id: kampagne.marke_id || null
  });
  return liste.id;
}

export async function openCastingPicker(creator) {
  const openId = openCastingListeId();
  if (openId) {
    try {
      await addCreatorToListe(openId, creator);
      window.toastSystem?.show('Ins Casting gelegt', 'success');
    } catch (error) {
      window.toastSystem?.show(error.message || 'Casting fehlgeschlagen', 'error');
    }
    return;
  }

  const name = `${creator.vorname || ''} ${creator.nachname || ''}`.trim();
  const esc = (value) => window.validatorSystem?.sanitizeHtml?.(String(value ?? '')) ?? String(value ?? '');
  const letzte = letzteKampagne();
  const letzteName = esc(String(letzte?.name || '').trim() || 'Kampagne');

  const { body, close } = openDrawer({
    id: DRAWER_ID,
    title: 'Ins Casting',
    subtitle: name ? `${esc(name)} einer Kampagne zuordnen` : 'Kampagne wählen',
    body: `
      ${letzte ? `
        <div class="form-field">
          <label>Zuletzt gewählt</label>
          <button type="button" class="mdc-btn" data-action="casting-letzte">Zu „${letzteName}“ hinzufügen</button>
          <p class="form-hint">Oder unten eine andere Kampagne suchen.</p>
        </div>` : ''}
      <div class="form-field">
        <label for="casting-kampagne-search-input">${letzte ? 'Andere Kampagne' : 'Kampagne'}</label>
        <div class="searchable-select-container">
          ${SearchInput.render('casting-kampagne', { placeholder: 'Kampagne suchen...' })}
          <div id="creator-casting-treffer" class="searchable-select-dropdown show"></div>
        </div>
      </div>
    `
  });

  const treffer = body.querySelector('#creator-casting-treffer');

  // Alphabetisch durch alle Kampagnen blaettern: die Liste laedt seitenweise
  // nach, solange gescrollt wird - ohne Suche wirkt sonst ein hartes Limit
  // wie "es gibt keine weiteren Kampagnen".
  const PAGE_SIZE = 50;
  const paging = { term: '', offset: 0, done: false, loading: false, request: 0 };

  const ladeWeitere = async () => {
    if (paging.loading || paging.done) return;
    paging.loading = true;
    const request = ++paging.request;

    const safe = paging.term.replace(/[%_,]/g, '').trim();
    let query = window.supabase
      .from('kampagne')
      .select('id, kampagnenname')
      .order('kampagnenname')
      .range(paging.offset, paging.offset + PAGE_SIZE - 1);
    if (safe) query = query.ilike('kampagnenname', `%${safe}%`);

    const { data, error } = await query;
    if (request !== paging.request) return; // Suche hat sich zwischenzeitlich geaendert

    if (error) {
      paging.loading = false;
      paging.done = true;
      treffer.innerHTML = '<div class="searchable-select-empty">Kampagnen konnten nicht geladen werden</div>';
      return;
    }

    const rows = data || [];
    paging.done = rows.length < PAGE_SIZE;
    paging.offset += rows.length;
    paging.loading = false;

    treffer.querySelector('.searchable-select-empty')?.remove();
    if (rows.length) {
      treffer.insertAdjacentHTML('beforeend', rows.map((row) => `
        <div class="searchable-select-item${row.id === letzte?.id ? ' selected' : ''}" data-kampagne="${esc(row.id)}" data-name="${esc(row.kampagnenname || '')}">
          <span class="searchable-select-item-label">${esc(row.kampagnenname || 'Kampagne')}</span>
        </div>`).join(''));
    }
    if (paging.done) {
      treffer.insertAdjacentHTML('beforeend', paging.offset === 0
        ? '<div class="searchable-select-empty">Keine Kampagne gefunden</div>'
        : `<div class="searchable-select-empty">Alle ${paging.offset} Kampagnen geladen</div>`);
    }
  };

  const suchen = (term) => {
    paging.term = String(term || '');
    paging.offset = 0;
    paging.done = false;
    paging.loading = false;
    paging.request += 1;
    treffer.innerHTML = '';
    ladeWeitere();
  };

  treffer.addEventListener('scroll', () => {
    if (treffer.scrollTop + treffer.clientHeight >= treffer.scrollHeight - 32) {
      ladeWeitere();
    }
  });

  const hinzufuegen = async (element, kampagneId, kampagneName) => {
    element.classList.add('is-disabled');
    element.disabled = true;
    try {
      const listeId = await ensureListeForKampagne(kampagneId);
      await addCreatorToListe(listeId, creator);
      merkeKampagne(kampagneId, kampagneName);
      window.toastSystem?.show('Ins Casting gelegt', 'success');
      close();
    } catch (error) {
      element.classList.remove('is-disabled');
      element.disabled = false;
      window.toastSystem?.show(error.message || 'Casting fehlgeschlagen', 'error');
    }
  };

  body.querySelector('[data-action="casting-letzte"]')?.addEventListener('click', (event) => {
    hinzufuegen(event.currentTarget, letzte.id, letzte.name);
  });

  treffer.addEventListener('click', (event) => {
    const option = event.target.closest('[data-kampagne]');
    if (option) hinzufuegen(option, option.dataset.kampagne, option.dataset.name);
  });

  SearchInput.bind('casting-kampagne', (value) => suchen(value));
  suchen('');
}
