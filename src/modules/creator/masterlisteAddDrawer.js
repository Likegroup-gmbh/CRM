// Drawer "Creator hinzufügen" der Masterliste, aufgebaut wie im Casting:
// Neuer Creator (Profilfelder, Instagram optional), Aus Datenbank, Mehrere Links.
// Angelegt wird ueber CreatorListDetail (addEintrag, addMember, addLinks).

import { creatorAuswahlService } from '../creator-auswahl/CreatorAuswahlService.js';
import { ladeCreatorFuerHandles } from '../creator-auswahl/castingCreatorVerknuepfung.js';
import { CREATOR_TYP_OPTIONS } from '../creator-auswahl/creatorTypeOptions.js';
import {
  IG_TEXT_FIELDS,
  applyPreviewToForm,
  instagramProfilHandle,
  leereIgOwners,
  markUserEdit,
  normalizedInstagramUrl
} from '../creator-auswahl/instagramDrawerFill.js';
import {
  creatorName,
  escapeHtml,
  leseMasterlisteLinks,
  linkZaehlerText,
  teileHandlesAuf
} from './masterliste.js';

const IG_LADE_TEXT = 'Instagram-Daten werden geladen…';

const MODI = [
  { mode: 'new', label: 'Neuer Creator' },
  { mode: 'database', label: 'Aus Datenbank' },
  { mode: 'links', label: 'Mehrere Links' }
];

const UNTERTITEL = {
  new: 'Creator ohne Datensatz in den Stammdaten auf diese Masterliste setzen',
  database: 'Bestehenden Creator aus den Stammdaten auf diese Masterliste setzen',
  links: 'Mehrere Instagram-Profile auf einmal auf diese Masterliste setzen'
};

function footer(submitLabel, disabled) {
  return `
    <div class="drawer-footer u-mt-lg">
      <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close-masterliste-add">
        <span class="mdc-btn__label">Abbrechen</span>
      </button>
      <button type="submit" class="mdc-btn mdc-btn--create" id="masterliste-add-confirm" ${disabled ? 'disabled' : ''}>
        <span class="mdc-btn__label">${submitLabel}</span>
      </button>
    </div>
  `;
}

export class MasterlisteAddDrawer {
  constructor(detail) {
    this.detail = detail;
    this.mode = 'new';
    this.request = 0;
    this.gesperrt = false;
  }

  open(mode = 'new') {
    this.mode = mode;
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'masterliste-add-overlay';
    const panel = document.createElement('div');
    panel.className = 'drawer-panel';
    panel.id = 'masterliste-add-drawer';
    panel.setAttribute('role', 'dialog');
    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Creator hinzufügen</span>
          <p class="drawer-subtitle" id="masterliste-add-subtitle">${UNTERTITEL[mode]}</p>
        </div>
        <div><button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button></div>
      </div>
      <div class="drawer-toggle-container">
        <div class="view-toggle">
          ${MODI.map(item => `<button type="button" class="mdc-btn mdc-btn--secondary${item.mode === mode ? ' active' : ''}" data-mode="${item.mode}">${item.label}</button>`).join('')}
        </div>
      </div>
      <div class="drawer-body" id="masterliste-add-body"></div>
    `;
    const close = () => this.close();
    overlay.addEventListener('click', close);
    panel.querySelector('.drawer-close-btn').addEventListener('click', close);
    panel.querySelectorAll('.view-toggle .mdc-btn').forEach(button => {
      button.addEventListener('click', () => this.switchMode(button.dataset.mode));
    });
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    this.renderBody();
    requestAnimationFrame(() => panel.classList.add('show'));
  }

  close() {
    this.request += 1;
    this.detail.closeDrawers();
  }

  switchMode(mode) {
    if (!MODI.some(item => item.mode === mode)) return;
    this.mode = mode;
    this.request += 1;
    document.querySelectorAll('#masterliste-add-drawer .view-toggle .mdc-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.mode === mode);
    });
    const subtitle = document.getElementById('masterliste-add-subtitle');
    if (subtitle) subtitle.textContent = UNTERTITEL[mode];
    this.renderBody();
  }

  renderBody() {
    const body = document.getElementById('masterliste-add-body');
    if (!body) return;
    this.gesperrt = false;
    if (this.mode === 'database') body.innerHTML = this.renderDatabase();
    else if (this.mode === 'links') body.innerHTML = this.renderLinks();
    else body.innerHTML = this.renderNew();

    const form = body.querySelector('#masterliste-add-form');
    form.querySelector('[data-action="close-masterliste-add"]')?.addEventListener('click', () => this.close());
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleSubmit(form);
    });
    if (this.mode === 'database') this.bindDatabase(form);
    else if (this.mode === 'links') this.bindLinks(form);
    else this.bindNew(form);
  }

  renderNew() {
    const typOptionen = CREATOR_TYP_OPTIONS
      .map(typ => `<option value="${escapeHtml(typ)}">${escapeHtml(typ)}</option>`)
      .join('');
    return `
      <form id="masterliste-add-form" autocomplete="off">
        <div class="form-field">
          <label class="form-label" for="masterliste-creator-typ">Creator Art *</label>
          <select id="masterliste-creator-typ" name="typ" class="form-input" required>
            <option value="">Bitte wählen...</option>
            ${typOptionen}
          </select>
        </div>

        <div class="form-field">
          <label class="form-label" for="masterliste-creator-name">Name *</label>
          <input type="text" id="masterliste-creator-name" name="name" class="form-input" placeholder="Name des Creators" required>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="form-label" for="masterliste-ig-link">Link Instagram</label>
            <input type="url" id="masterliste-ig-link" name="link_instagram" class="form-input" placeholder="https://instagram.com/...">
            <p id="masterliste-ig-status" class="form-hint" hidden></p>
            <div id="masterliste-ig-vorschau" class="masterliste-ig-vorschau" hidden></div>
          </div>
          <div class="form-field">
            <label class="form-label">Follower IG</label>
            <input type="number" name="follower_instagram" class="form-input" placeholder="z.B. 10000" min="0">
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="form-label">Link TikTok</label>
            <input type="url" name="link_tiktok" class="form-input" placeholder="https://tiktok.com/@...">
          </div>
          <div class="form-field">
            <label class="form-label">Follower TikTok</label>
            <input type="number" name="follower_tiktok" class="form-input" placeholder="z.B. 50000" min="0">
          </div>
        </div>

        <div class="form-field">
          <label class="form-label">Location</label>
          <input type="text" name="wohnort" class="form-input" placeholder="z.B. Berlin">
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="form-label">Mail</label>
            <input type="text" name="email" class="form-input" placeholder="mail@...">
          </div>
          <div class="form-field">
            <label class="form-label">Telefon</label>
            <input type="text" name="telefon" class="form-input" placeholder="+49...">
          </div>
        </div>

        ${footer('Creator hinzufügen', false)}
      </form>
    `;
  }

  renderDatabase() {
    return `
      <form id="masterliste-add-form">
        <div class="form-field sourcing-search-section">
          <label class="form-label" for="masterliste-creator-select">Creator suchen</label>
          <select id="masterliste-creator-select" name="creator_id" class="form-input">
            <option value="">Name, Instagram oder TikTok eingeben...</option>
          </select>
          <small class="form-hint">Suche nach bestehenden Creators in der Datenbank</small>
        </div>
        ${footer('Hinzufügen', true)}
      </form>
    `;
  }

  renderLinks() {
    return `
      <form id="masterliste-add-form" autocomplete="off">
        <div class="form-field">
          <label class="form-label" for="masterliste-links">Instagram-Links *</label>
          <textarea id="masterliste-links" name="links" class="form-input" rows="8"
                    placeholder="https://instagram.com/creator_eins&#10;https://instagram.com/creator_zwei"></textarea>
          <small class="form-hint">Getrennt durch Leerzeichen, Zeilenumbruch, Komma oder Semikolon. Nur Profil-Links, keine Reels oder Posts.</small>
          <p id="masterliste-links-zaehler" class="form-hint" hidden></p>
        </div>
        ${footer('Creator hinzufügen', true)}
      </form>
    `;
  }

  bindNew(form) {
    this.igOwners = leereIgOwners();
    this.igHandle = null;
    const input = form.querySelector('#masterliste-ig-link');
    const pruefen = () => {
      if (instagramProfilHandle(input.value) === this.igHandle && this.igHandle) return;
      this.pruefeLink(input.value);
    };
    input.addEventListener('paste', () => setTimeout(pruefen, 0));
    input.addEventListener('blur', pruefen);
    for (const field of IG_TEXT_FIELDS) {
      form.querySelector(`[name="${field}"]`)?.addEventListener('input', () => {
        this.igOwners = markUserEdit(this.igOwners, field);
      });
    }
    form.querySelector('#masterliste-creator-typ')?.focus();
  }

  formularWerte(form) {
    const werte = {};
    form?.querySelectorAll('input[name], select[name]').forEach(el => { werte[el.name] = el.value; });
    return werte;
  }

  /** Name, Kontakt und Follower aus der Vorschau; was der Nutzer getippt hat, bleibt. */
  schreibeVorschauInFelder(fields) {
    const form = document.getElementById('masterliste-add-form');
    if (!form) return;
    const applied = applyPreviewToForm(this.formularWerte(form), this.igOwners, fields);
    for (const field of IG_TEXT_FIELDS) {
      const el = form.querySelector(`[name="${field}"]`);
      if (el) el.value = applied.values[field] ?? '';
    }
    const follower = form.querySelector('[name="follower_instagram"]');
    if (follower) follower.value = applied.values.follower_instagram;
    this.igOwners = applied.owners;
  }

  bindLinks(form) {
    const textarea = form.querySelector('#masterliste-links');
    const zaehler = form.querySelector('#masterliste-links-zaehler');
    const confirm = form.querySelector('#masterliste-add-confirm');
    const aktualisieren = () => {
      const gelesen = leseMasterlisteLinks(textarea.value);
      const text = linkZaehlerText(gelesen);
      zaehler.hidden = !text;
      zaehler.textContent = text;
      zaehler.classList.toggle('form-hint--error', !gelesen.handles.length && gelesen.ungueltig.length > 0);
      confirm.disabled = !gelesen.handles.length;
    };
    textarea.addEventListener('input', aktualisieren);
    textarea.focus();
  }

  bindDatabase(form) {
    const select = form.querySelector('#masterliste-creator-select');
    const confirm = form.querySelector('#masterliste-add-confirm');
    select.addEventListener('change', () => { confirm.disabled = !select.value; });
    if (!window.formSystem?.createSimpleSearchableSelect) return;
    const excluded = new Set(this.detail.members.map(member => member.creator?.id).filter(Boolean));
    const loadCreators = async (query) => {
      try {
        let request = window.supabase.from('creator').select('id, vorname, nachname, instagram, tiktok').limit(20);
        const term = String(query || '').trim().replace(/[,()]/g, '');
        if (term) {
          request = request.or(`vorname.ilike.%${term}%,nachname.ilike.%${term}%,instagram.ilike.%${term}%,tiktok.ilike.%${term}%`);
        }
        const { data, error } = await request;
        if (error) throw error;
        return (data || [])
          .filter(creator => !excluded.has(creator.id))
          .map(creator => {
            const socials = [creator.instagram, creator.tiktok].filter(Boolean).join(', ');
            const name = creatorName(creator);
            return { value: creator.id, label: socials ? `${name} — ${socials}` : name };
          });
      } catch (error) {
        console.error('Creator-Suche fehlgeschlagen:', error);
        return [];
      }
    };
    window.formSystem.createSimpleSearchableSelect(select, [], {
      placeholder: 'Name, Instagram oder TikTok eingeben...',
      serverSearch: loadCreators
    });
  }

  async handleSubmit(form) {
    const confirm = form.querySelector('#masterliste-add-confirm');
    if (confirm?.disabled || this.gesperrt) return;
    let ok = false;
    if (confirm) confirm.disabled = true;
    try {
      if (this.mode === 'database') {
        const creatorId = form.querySelector('#masterliste-creator-select')?.value;
        ok = creatorId ? await this.detail.addMember(creatorId) : false;
      } else if (this.mode === 'links') {
        ok = await this.detail.addLinks(form.querySelector('#masterliste-links')?.value);
      } else {
        ok = await this.detail.addEintrag(this.formularWerte(form));
      }
    } finally {
      if (!ok && confirm?.isConnected) confirm.disabled = false;
    }
  }

  setStatus(message, { fehler = false } = {}) {
    const el = document.getElementById('masterliste-ig-status');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
    el.classList.toggle('form-hint--error', !!message && fehler);
  }

  setVorschau(html) {
    const el = document.getElementById('masterliste-ig-vorschau');
    if (!el) return;
    el.hidden = !html;
    el.innerHTML = html || '';
  }

  setGesperrt(gesperrt) {
    this.gesperrt = gesperrt;
    const confirm = document.getElementById('masterliste-add-confirm');
    if (confirm) confirm.disabled = gesperrt;
  }

  /** Ein Link: Bestand und Stammdaten pruefen, sonst Instagram-Vorschau zeigen. */
  async pruefeLink(raw) {
    const request = ++this.request;
    this.setVorschau('');
    this.setGesperrt(false);
    const handle = instagramProfilHandle(raw);
    this.igHandle = handle;
    if (!handle) {
      this.setStatus(String(raw || '').trim() ? 'Bitte einen Instagram-Profil-Link einfügen (kein Reel oder Post)' : '', { fehler: true });
      return;
    }

    this.setStatus(IG_LADE_TEXT);
    try {
      const creators = await ladeCreatorFuerHandles([handle]);
      if (request !== this.request) return;
      const { schonDabei, crmTreffer } = teileHandlesAuf([handle], this.detail.members, creators);
      if (schonDabei.length) {
        this.setStatus(`@${handle} steht schon auf dieser Masterliste.`, { fehler: true });
        this.setGesperrt(true);
        return;
      }
      if (crmTreffer.length) {
        this.setStatus(`${creatorName(crmTreffer[0].creator)} (@${handle}) ist schon in der Datenbank und wird verknüpft.`);
        return;
      }

      const result = await creatorAuswahlService.previewInstagramStats(raw);
      if (request !== this.request) return;
      if (String(result?.username || '').toLowerCase() !== handle) {
        this.setStatus('Instagram konnte nicht geladen werden', { fehler: true });
        return;
      }
      this.setStatus('');
      this.setVorschau(vorschauHtml(handle, result.fields || {}));
      this.schreibeVorschauInFelder(result.fields || {});
      const input = document.getElementById('masterliste-ig-link');
      if (input) input.value = normalizedInstagramUrl(handle);
    } catch (error) {
      if (request !== this.request) return;
      const text = [error?.message, error?.hint].filter(Boolean).join(' ');
      this.setStatus(text || 'Instagram-Abruf fehlgeschlagen', { fehler: true });
    }
  }
}

function vorschauHtml(handle, fields) {
  const name = String(fields.name || '').trim() || `@${handle}`;
  const follower = Number(fields.follower_instagram);
  const followerText = Number.isFinite(follower) && fields.follower_instagram != null
    ? `${follower.toLocaleString('de-DE')} Follower`
    : '';
  const bild = fields.profile_image_thumb_url || fields.profile_image_url;
  const safe = bild && window.validatorSystem?.sanitizeUrl
    ? window.validatorSystem.sanitizeUrl(bild)
    : (/^https?:\/\//i.test(bild || '') ? bild : '');
  const avatar = safe
    ? `<img src="${escapeHtml(safe)}" alt="" class="table-avatar table-avatar-img" width="32" height="32">`
    : `<span class="table-avatar">${escapeHtml(name.replace(/^@/, '').charAt(0).toUpperCase() || '?')}</span>`;
  return `
    ${avatar}
    <div>
      <div class="masterliste-ig-vorschau__name">${escapeHtml(name)}</div>
      <div class="form-hint">@${escapeHtml(handle)}${followerText ? ` · ${escapeHtml(followerText)}` : ''}</div>
    </div>
  `;
}
