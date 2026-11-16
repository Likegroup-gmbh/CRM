// E-Mail-Feld beider Teilen-Drawer (Listen und Skript-Paket): Tags, Trennung per Komma
// oder Semikolon, Einfügen mehrerer Adressen (auch "Name <mail>"), Ansprechpartner-Suche
// und optionale Ansprechpartner-Chips.

import { escapeHtml } from '../format.js';

const SUCHE_VERZOEGERUNG_MS = 200;
const MAX_TREFFER = 8;

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

/** Eingefügter Text mit Komma, Semikolon, Leerzeichen oder Zeilenumbruch, auch "Name <mail>". */
export function emailsAusText(text) {
  const out = [];
  for (const teil of String(text || '').split(/[\s,;]+/)) {
    const email = teil.replace(/^[<("']+|[>)"']+$/g, '').trim().toLowerCase();
    if (isValidEmail(email) && !out.includes(email)) out.push(email);
  }
  return out;
}

function feldHtml({ idPrefix, inputId, placeholder }) {
  return `
    <div class="tag-input-container" id="${idPrefix}-container">
      <div class="tag-input-wrapper">
        <div class="selected-tags" id="${idPrefix}-tags"></div>
        <input type="text" class="tag-input" id="${inputId}" placeholder="${escapeHtml(placeholder)}"
               autocomplete="off" aria-label="E-Mail-Adressen">
      </div>
      <div class="tag-suggestions" id="${idPrefix}-suggestions" style="display:none;"></div>
    </div>
    <div class="skript-paket-vorschlaege" id="${idPrefix}-vorschlaege" hidden></div>`;
}

async function sucheAnsprechpartner(term) {
  const safe = term.replace(/[,()%]/g, '').slice(0, 80);
  if (!safe || !window.supabase) return null;
  const { data } = await window.supabase
    .from('ansprechpartner')
    .select('id, vorname, nachname, email, unternehmen:unternehmen_id(firmenname)')
    .or(`vorname.ilike.%${safe}%,nachname.ilike.%${safe}%,email.ilike.%${safe}%`)
    .order('nachname');
  return data || [];
}

/**
 * Baut das Feld in `container`. `onChange(emails)` läuft nach jeder Änderung durch den Nutzer.
 * `vorschlaege`: [{ email, name }] als Chips; schon getaggte Adressen werden ausgeblendet.
 */
export function mountShareEmailField(container, {
  emails = [],
  vorschlaege = [],
  onChange = () => {},
  idPrefix = 'share-email',
  inputId = `${idPrefix}-input`,
  placeholder = 'E-Mails eingeben oder einfügen …',
} = {}) {
  container.innerHTML = feldHtml({ idPrefix, inputId, placeholder });
  const input = container.querySelector('.tag-input');
  const tagsEl = container.querySelector('.selected-tags');
  const suggestions = container.querySelector('.tag-suggestions');
  const chipsEl = container.querySelector(`#${idPrefix}-vorschlaege`);
  const state = { emails: [], vorschlaege, timer: null, gen: 0 };

  const renderChips = () => {
    const offen = (state.vorschlaege || []).filter((ap) => ap.email && !state.emails.includes(ap.email));
    chipsEl.hidden = !offen.length;
    chipsEl.innerHTML = offen.length ? `
      <span class="skript-paket-vorschlaege-label">Ansprechpartner</span>
      ${offen.map((ap) => `
        <button type="button" class="skript-paket-vorschlag" data-email="${escapeHtml(ap.email)}"
                title="${escapeHtml(ap.email)}">+ ${escapeHtml(ap.name || ap.email)}</button>`).join('')}
      ${offen.length > 1 ? '<button type="button" class="skript-paket-vorschlag skript-paket-vorschlag--alle" data-alle-vorschlaege>Alle hinzufügen</button>' : ''}` : '';
  };

  const render = () => {
    tagsEl.innerHTML = state.emails.map((email) => `
      <span class="tag-item" data-email="${escapeHtml(email)}">
        ${escapeHtml(email)}
        <span class="tag-remove" data-email="${escapeHtml(email)}">&times;</span>
      </span>`).join('');
    renderChips();
  };

  const setEmails = (list) => {
    state.emails = [];
    for (const raw of list || []) {
      const email = String(raw || '').trim().toLowerCase();
      if (isValidEmail(email) && !state.emails.includes(email)) state.emails.push(email);
    }
    render();
  };

  const aendern = () => {
    render();
    onChange([...state.emails]);
  };

  /** Gibt die Zahl neuer Adressen zurück. */
  const hinzufuegen = (list) => {
    const neu = list.filter((email) => !state.emails.includes(email));
    if (!neu.length) return 0;
    state.emails.push(...neu);
    aendern();
    return neu.length;
  };

  const hideSuggestions = () => {
    clearTimeout(state.timer);
    state.gen += 1;
    suggestions.style.display = 'none';
    suggestions.innerHTML = '';
  };

  /** Übernimmt den Text im Eingabefeld. false, wenn dort keine gültige Adresse stand. */
  const commit = ({ warn = false } = {}) => {
    const raw = input.value.trim();
    if (!raw) return true;
    const gefunden = emailsAusText(raw);
    if (!gefunden.length) {
      if (warn) window.toastSystem?.warning('Ungültige E-Mail-Adresse.');
      return false;
    }
    hinzufuegen(gefunden);
    input.value = '';
    hideSuggestions();
    return true;
  };

  const zeigeTreffer = async (term) => {
    const gen = ++state.gen;
    const rows = await sucheAnsprechpartner(term);
    if (gen !== state.gen || !input.isConnected) return;
    if (rows === null) return hideSuggestions();
    const treffer = rows.filter((ap) => {
      const email = String(ap.email || '').trim().toLowerCase();
      return email && isValidEmail(email) && !state.emails.includes(email);
    }).slice(0, MAX_TREFFER);
    suggestions.style.display = 'block';
    if (!treffer.length) {
      suggestions.innerHTML = '<div class="suggestion-hint">Keine Vorschläge</div>';
      return;
    }
    suggestions.innerHTML = treffer.map((ap) => {
      const name = `${ap.vorname || ''} ${ap.nachname || ''}`.trim();
      const email = String(ap.email).trim();
      const meta = [email, ap.unternehmen?.firmenname].filter(Boolean).join(' · ');
      return `<div class="suggestion-item" data-email="${escapeHtml(email)}">
        ${escapeHtml(name || email)}
        <span class="suggestion-item-meta">${escapeHtml(meta)}</span>
      </div>`;
    }).join('');
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) return;
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault();
      commit({ warn: true });
    } else if (e.key === 'Backspace' && !input.value && state.emails.length) {
      state.emails.pop();
      aendern();
    } else if (e.key === 'Escape' && suggestions.style.display !== 'none') {
      // Erst die Vorschläge schließen, der Drawer bleibt offen
      e.stopPropagation();
      hideSuggestions();
    }
  });

  input.addEventListener('paste', (e) => {
    const gefunden = emailsAusText(e.clipboardData?.getData('text') || '');
    if (!gefunden.length) return;
    e.preventDefault();
    hinzufuegen(gefunden);
    input.value = '';
    hideSuggestions();
  });

  input.addEventListener('input', () => {
    if (/[,;]/.test(input.value)) {
      const teile = input.value.split(/[,;]/);
      const rest = teile.pop();
      hinzufuegen(teile.flatMap((teil) => emailsAusText(teil)));
      input.value = rest.trimStart();
    }
    const term = input.value.trim();
    clearTimeout(state.timer);
    if (!term) return hideSuggestions();
    state.timer = setTimeout(() => zeigeTreffer(term), SUCHE_VERZOEGERUNG_MS);
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (!input.isConnected) return;
      commit({ warn: false });
      hideSuggestions();
    }, 150);
  });

  suggestions.addEventListener('mousedown', (e) => e.preventDefault());
  suggestions.addEventListener('click', (e) => {
    const item = e.target.closest('.suggestion-item');
    if (!item?.dataset.email) return;
    hinzufuegen([item.dataset.email.trim().toLowerCase()]);
    input.value = '';
    hideSuggestions();
    input.focus();
  });

  tagsEl.addEventListener('click', (e) => {
    const remove = e.target.closest('.tag-remove');
    if (!remove) return;
    state.emails = state.emails.filter((email) => email !== remove.dataset.email);
    aendern();
  });

  chipsEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-alle-vorschlaege]')) {
      hinzufuegen(state.vorschlaege.map((ap) => ap.email).filter(Boolean));
      return;
    }
    const chip = e.target.closest('[data-email]');
    if (chip) hinzufuegen([chip.dataset.email]);
  });

  setEmails(emails);

  return {
    input,
    get emails() { return [...state.emails]; },
    setEmails,
    setVorschlaege(list) {
      state.vorschlaege = list || [];
      renderChips();
    },
    commit,
    hideSuggestions,
    destroy() {
      clearTimeout(state.timer);
      state.gen += 1;
    },
  };
}
