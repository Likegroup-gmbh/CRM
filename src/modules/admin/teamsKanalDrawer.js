// teamsKanalDrawer.js
// Drawer der Seite Teams-Kanäle: Name, Workflow-Link, Aktiv und die abgedeckten Unternehmen
// eines Teams-Kanals anlegen oder ändern (ADR 0066). Speichert direkt über supabase-js,
// die Tabellen sind per RLS nur für Admins.

import { escapeHtml } from '../../core/format.js';
import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';

const OVERLAY_ID = 'teams-kanal-drawer-overlay';
const PANEL_ID = 'teams-kanal-drawer';

// Gleiche Regel wie der Server (netlify/functions/_shared/teams/webhook.js)
const ERLAUBTE_HOSTS = [/\.powerplatform\.com$/i, /\.logic\.azure\.com$/i];

/** @returns {string|null} Fehlertext oder null, wenn die URL passt */
export function webhookUrlFehler(url) {
  let u;
  try {
    u = new URL(String(url || '').trim());
  } catch {
    return 'Bitte den Link aus dem Workflow einfügen.';
  }
  if (u.protocol !== 'https:') return 'Der Link muss mit https:// beginnen.';
  if (!ERLAUBTE_HOSTS.some((re) => re.test(u.hostname))) {
    return 'Der Link gehört nicht zu Microsoft Workflows (powerplatform.com oder logic.azure.com).';
  }
  return null;
}

function unternehmenListeHtml(unternehmen, gewaehlt) {
  if (!unternehmen.length) return '<div class="dq-leer">Keine Unternehmen.</div>';
  return unternehmen.map((u) => `
    <label class="tk-option" data-tk-name="${escapeHtml(String(u.firmenname || '').toLowerCase())}">
      <input type="checkbox" value="${escapeHtml(u.id)}" data-tk-unternehmen${gewaehlt.has(String(u.id)) ? ' checked' : ''}>
      <span>${escapeHtml(u.firmenname || 'Ohne Namen')}</span>
      ${u.ist_test ? '<span class="status-badge info">Test</span>' : ''}
    </label>
  `).join('');
}

function formHtml(kanal, unternehmen, gewaehlt) {
  return `
    <form class="tk-form" data-no-submit-guard="true">
      <div class="form-field">
        <label for="tk-name">Name *</label>
        <input type="text" id="tk-name" class="form-input" data-tk-feld="name" value="${escapeHtml(kanal?.name || '')}" placeholder="z. B. Team Beauty" required>
      </div>
      <div class="form-field">
        <label for="tk-url">Workflow-Link *</label>
        <input type="url" id="tk-url" class="form-input" data-tk-feld="webhook_url" value="${escapeHtml(kanal?.webhook_url || '')}" placeholder="https://….powerplatform.com/…" required autocomplete="off">
        <small class="form-hint">Im Teams-Kanal: … › Workflows › „Post to a channel when a webhook request is received“. Wer den Link hat, kann in den Kanal posten.</small>
      </div>
      <label class="tk-option tk-aktiv">
        <input type="checkbox" data-tk-feld="aktiv"${kanal?.aktiv === false ? '' : ' checked'}>
        <span>Aktiv: neue Kundenkommentare gehen in diesen Kanal</span>
      </label>
      <div class="form-field">
        <label>Unternehmen <span class="ma-leise" data-tk-anzahl></span></label>
        <input type="search" class="form-input" data-tk-suche placeholder="Unternehmen suchen" aria-label="Unternehmen suchen">
        <div class="tk-liste" data-tk-liste>${unternehmenListeHtml(unternehmen, gewaehlt)}</div>
        <small class="form-hint">Meldungen kommen für alle Marken und Kampagnen dieser Unternehmen.</small>
      </div>
      <p class="form-hint form-hint--error" data-tk-fehler hidden></p>
      <div class="drawer-actions">
        <button type="button" class="mdc-btn mdc-btn--cancel" data-tk-schliessen>
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button type="submit" class="mdc-btn mdc-btn--create" data-tk-speichern>
          <span class="mdc-btn__label">Speichern</span>
        </button>
      </div>
    </form>
  `;
}

async function zuordnungSpeichern(sb, kanalId, vorher, nachher) {
  const weg = [...vorher].filter((id) => !nachher.has(id));
  const neu = [...nachher].filter((id) => !vorher.has(id));
  if (weg.length) {
    const { error } = await sb.from('teams_kanal_unternehmen').delete().eq('kanal_id', kanalId).in('unternehmen_id', weg);
    if (error) throw error;
  }
  if (neu.length) {
    const { error } = await sb.from('teams_kanal_unternehmen').insert(neu.map((unternehmen_id) => ({ kanal_id: kanalId, unternehmen_id })));
    if (error) throw error;
  }
}

/**
 * @param {{ kanal: object|null, unternehmen: object[], gewaehlt: string[], onGespeichert: () => void }} opts
 *   kanal null = neuer Kanal
 */
export function openTeamsKanalDrawer({ kanal = null, unternehmen = [], gewaehlt = [], onGespeichert }) {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(PANEL_ID)?.remove();
  const vorher = new Set(gewaehlt.map(String));
  // Abgedeckte Unternehmen oben, damit man sie ohne Suche sieht
  const sortiert = [...unternehmen].sort((a, b) =>
    (vorher.has(String(b.id)) - vorher.has(String(a.id)))
    || String(a.firmenname || '').localeCompare(String(b.firmenname || ''), 'de'));

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = OVERLAY_ID;

  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.className = 'drawer-panel';
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="drawer-header">
      <div>
        <span class="drawer-title">${kanal ? 'Teams-Kanal bearbeiten' : 'Teams-Kanal hinzufügen'}</span>
        <p class="drawer-subtitle">Kanal und Mitglieder legst du in Teams an, hier nur die Verbindung.</p>
      </div>
      <div><button class="drawer-close-btn" type="button" aria-label="Schließen" data-tk-schliessen>&times;</button></div>
    </div>
    <div class="drawer-body">${formHtml(kanal, sortiert, vorher)}</div>
  `;

  const form = panel.querySelector('form');
  const fehlerEl = panel.querySelector('[data-tk-fehler]');
  const anzahlEl = panel.querySelector('[data-tk-anzahl]');
  const feld = (name) => panel.querySelector(`[data-tk-feld="${name}"]`);
  const gewaehltJetzt = () => new Set([...panel.querySelectorAll('[data-tk-unternehmen]:checked')].map((el) => el.value));

  const zaehlen = () => {
    const n = gewaehltJetzt().size;
    anzahlEl.textContent = n ? `(${n} ausgewählt)` : '';
  };
  const fehler = (text) => {
    fehlerEl.textContent = text || '';
    fehlerEl.hidden = !text;
  };
  const schliessen = () => {
    panel.classList.remove('show');
    setTimeout(() => {
      overlay.remove();
      panel.remove();
    }, DRAWER_EXIT_MS);
  };

  let speichert = false;
  const speichern = async (e) => {
    e.preventDefault();
    if (speichert) return;
    const name = feld('name').value.trim();
    const url = feld('webhook_url').value.trim();
    if (!name) return fehler('Bitte einen Namen eingeben.');
    const urlFehler = webhookUrlFehler(url);
    if (urlFehler) return fehler(urlFehler);
    fehler('');

    speichert = true;
    const knopf = panel.querySelector('[data-tk-speichern]');
    knopf.disabled = true;
    try {
      const sb = window.supabase;
      const daten = { name, webhook_url: url, aktiv: feld('aktiv').checked };
      let kanalId = kanal?.id;
      if (kanalId) {
        const { error } = await sb.from('teams_kanal').update(daten).eq('id', kanalId);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from('teams_kanal')
          .insert({ ...daten, created_by: window.currentUser?.id || null })
          .select('id').single();
        if (error) throw error;
        kanalId = data.id;
      }
      await zuordnungSpeichern(sb, kanalId, vorher, gewaehltJetzt());
      window.toastSystem?.show?.(`Teams-Kanal „${name}“ gespeichert.`, 'success');
      schliessen();
      onGespeichert?.();
    } catch (err) {
      console.error('❌ Teams-Kanal speichern fehlgeschlagen', err);
      fehler(`Speichern fehlgeschlagen: ${err?.message || 'Unbekannt'}`);
    } finally {
      speichert = false;
      knopf.disabled = false;
    }
  };

  overlay.addEventListener('click', schliessen);
  panel.querySelectorAll('[data-tk-schliessen]').forEach((btn) => btn.addEventListener('click', schliessen));
  form.addEventListener('submit', speichern);
  panel.addEventListener('change', (e) => {
    if (e.target.matches('[data-tk-unternehmen]')) zaehlen();
  });
  panel.querySelector('[data-tk-suche]').addEventListener('input', (e) => {
    const q = String(e.target.value || '').trim().toLowerCase();
    panel.querySelectorAll('.tk-option[data-tk-name]').forEach((row) => {
      row.hidden = !!q && !row.dataset.tkName.includes(q);
    });
  });

  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  zaehlen();
  requestAnimationFrame(() => panel.classList.add('show'));
  return { panel, schliessen };
}
