// ProduktPersonaPanel.js
// Die Doc-Gruppe "Einsatzsituationen & Personas" im Produkt-Worksheet.
//
// Linke Spalte: nummerierte, editierbare Use-Case-Liste (Source of Truth am
// Produkt) + das 3er-Grid der Persona-Karten. Rechte Spalte: Aktions-Rail
// (Neu generieren / Alle annehmen / Alle verwerfen + Save-Hinweis).
//
// Der Stand lebt komplett im Speicher und wird erst mit dem Produkt-Save
// geschrieben (ProduktPersonaService.flushOnSave) - Annehmen, Zuruecknehmen
// und Verwerfen vor dem Save sind reine State-Wechsel.
//
// Trigger: automatisch nach einem Site-Extract (siteExtractFinished), aber
// nur wenn noch keine Karten existieren. Sonst per Button, sobald das
// Substance-Gate steht (Name + USP/Pains/Kurzbeschreibung).

import { ProduktPersonaService } from './ProduktPersonaService.js';
import { ProduktPersonaDrawer } from './ProduktPersonaDrawer.js';
import { icon } from '../../core/icons/IconSystem.js';

// Felder, die in den Job-Input laufen (Reihenfolge = Prompt-Reihenfolge).
// einsatzsituation hat kein Formularfeld mehr - sie kommt als Seed aus dem
// letzten Extract bzw. dem Legacy-Wert des Produkts.
const JOB_FELDER = ['name', 'kurzbeschreibung', 'usp', 'pain_points', 'loesung', 'preis_von', 'preis_bis'];

const MAX_KARTEN = 6;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tempKey(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export class ProduktPersonaPanel {
  constructor() {
    this.form = null;
    this.kontext = null; // { produktId, unternehmenId, markeId, getMarkeIds, legacyEinsatzsituation }
    this.useCases = [];
    this.karten = [];
    this.verworfeneMatchIds = [];
    this.extractSeed = null;
    this.jobRunning = false;
    this.loaded = !this.produktId; // Create-Modus: sofort bereit
    this.drawer = new ProduktPersonaDrawer();
    this._abort = null;
  }

  get produktId() {
    return this.kontext?.produktId || null;
  }

  /**
   * @param {HTMLFormElement} form
   * @param {Object} kontext - { produktId, unternehmenId, markeId, getMarkeIds, legacyEinsatzsituation }
   */
  async mount(form, kontext) {
    this._abort?.abort();
    this._abort = new AbortController();
    this.form = form;
    this.kontext = kontext;
    this.useCases = [];
    this.karten = [];
    this.verworfeneMatchIds = [];
    this.extractSeed = null;
    this.jobRunning = false;
    this.loaded = !this.produktId;

    this.render();

    if (this.produktId) {
      await this.loadPersisted();
    }

    this.bindEvents();
  }

  async loadPersisted() {
    try {
      const [useCases, vorschlaege, verworfene] = await Promise.all([
        ProduktPersonaService.loadUseCases(this.produktId),
        ProduktPersonaService.loadVorschlaege(this.produktId),
        ProduktPersonaService.loadVerworfeneMatchIds(this.produktId)
      ]);

      this.useCases = useCases.map(uc => ({
        key: uc.id,
        id: uc.id,
        name: uc.name,
        beschreibung: uc.beschreibung || '',
        deleted: false
      }));

      const keySet = new Set(this.useCases.map(uc => uc.key));
      this.karten = vorschlaege.map(v => ({
        key: v.id,
        id: v.id,
        typ: v.typ,
        status: v.status,
        persona_id: v.persona_id,
        persona: v.persona || null,
        payload: v.payload || null,
        fit_grund: v.fit_grund || '',
        useCaseKeys: (v.use_case_ids || []).filter(id => keySet.has(id)),
        position: v.position ?? 0,
        persisted: { status: v.status, persona_id: v.persona_id }
      }));

      this.verworfeneMatchIds = verworfene;
      this.loaded = true;
      this.render();
    } catch (err) {
      console.error('Persona-Vorschläge konnten nicht geladen werden:', err);
    }
  }

  bindEvents() {
    const signal = this._abort?.signal;
    const opts = signal ? { signal } : undefined;

    // Chain: nach dem Extract automatisch starten - aber nur, wenn noch
    // keine Karten existieren (zweites Extract feuert nicht neu)
    document.addEventListener('siteExtractFinished', (e) => {
      if (e.detail?.entity !== 'produkt' || !e.detail?.ok) return;
      const seed = e.detail.fields?.einsatzsituation?.value;
      if (seed) this.extractSeed = seed;
      if (!this.karten.some(k => k.status !== 'deleted')) {
        this.startJob('initial', null, { leise: true });
      }
    }, opts);

    const root = this.root();
    if (!root) return;

    root.addEventListener('click', (e) => this.handleClick(e), opts);
    root.addEventListener('input', (e) => this.handleInput(e), opts);
  }

  root() {
    return this.form?.querySelector('#produkt-persona-panel');
  }

  // --- State-Zugriffe ---

  visibleUseCases() {
    return this.useCases.filter(uc => !uc.deleted);
  }

  aktiveKarten() {
    return this.karten
      .filter(k => k.status !== 'deleted')
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  hasSubstance() {
    const wert = (name) => this.form?.querySelector(`[name="${name}"]`)?.value?.trim() || '';
    return Boolean(wert('name') && (wert('usp') || wert('pain_points') || wert('kurzbeschreibung')));
  }

  kartenDaten(karte) {
    // Anzeige-Daten: bei match aus dem DB-Record, bei neu aus dem payload
    const quelle = karte.typ === 'match' ? (karte.persona || {}) : (karte.payload || {});
    const alter = quelle.alter_von != null
      ? (quelle.alter_bis != null ? `${quelle.alter_von}–${quelle.alter_bis}` : `ab ${quelle.alter_von}`)
      : (quelle.alter_bis != null ? `bis ${quelle.alter_bis}` : null);
    return {
      name: quelle.name || 'Persona',
      alter,
      oberbegriff: quelle.oberbegriff || '',
      text: karte.typ === 'match'
        ? (karte.fit_grund || '')
        : (quelle.beschreibung || karte.fit_grund || '')
    };
  }

  // --- Job ---

  async startJob(modus, ersetzteKarte = null, { leise = false } = {}) {
    if (this.jobRunning) return;
    if (!this.hasSubstance()) {
      // Auto-Chain nach dem Extract skippt still, der Button erklaert sich
      if (!leise) {
        window.toastSystem?.warning?.('Bitte zuerst Name plus USP, Pain Points oder Kurzbeschreibung ausfüllen');
      }
      return;
    }

    this.jobRunning = true;
    this.render();

    const gesendeteUseCases = this.visibleUseCases();
    const gesendeteKeys = gesendeteUseCases.map(uc => uc.key);

    const ausschluss = new Set(this.verworfeneMatchIds);
    for (const k of this.karten) {
      if (k.status !== 'deleted' && k.persona_id) ausschluss.add(k.persona_id);
    }

    const behalten = this.karten
      .filter(k => k.status === 'accepted')
      .map(k => ({ typ: k.typ, name: this.kartenDaten(k).name }));

    const input = {
      modus,
      felder: this.buildJobFelder(),
      marke_ids: this.kontext?.getMarkeIds?.() || [],
      bestehende_use_cases: gesendeteUseCases.map(uc => ({ name: uc.name, beschreibung: uc.beschreibung || null })),
      ausschluss_persona_ids: [...ausschluss],
      behalten,
      anzahlZiel: modus === 'karte'
        ? 1
        : (modus === 'alle' ? Math.max(1, MAX_KARTEN - behalten.length) : MAX_KARTEN),
      ersetzteKarte: ersetzteKarte ? { typ: ersetzteKarte.typ } : null
    };

    try {
      const result = await ProduktPersonaService.starteJob({
        produktId: this.produktId,
        unternehmenId: this.kontext?.getUnternehmenId?.() || null,
        input
      });
      this.applyJobResult(result, { gesendeteKeys, ersetzteKarte });
      window.toastSystem?.success?.('Persona-Vorschläge sind da');
    } catch (err) {
      console.error('Persona-Generierung fehlgeschlagen:', err);
      window.toastSystem?.error?.(err.message || 'Persona-Vorschläge fehlgeschlagen');
      // Bei karte/alle wurde die alte Karte schon verworfen - sie bleibt es,
      // der Nutzer kann neu generieren. Kein automatisches Zurueckholen.
    } finally {
      this.jobRunning = false;
      this.render();
    }
  }

  buildJobFelder() {
    const felder = {};
    for (const name of JOB_FELDER) {
      const input = this.form?.querySelector(`[name="${name}"]`);
      const value = input?.value?.trim();
      if (!value) continue;
      felder[name] = { value, kind: this.fieldKind(input) };
    }

    const seed = this.extractSeed || this.kontext?.legacyEinsatzsituation;
    if (seed?.trim()) {
      felder.einsatzsituation = { value: seed.trim(), kind: 'guess' };
    }
    return felder;
  }

  /** fact/guess aus der Extract-Markierung im DOM, sonst manuell. */
  fieldKind(input) {
    // Gleiche Wrapper-Aufloesung wie der ExtractReviewLayer (das Produkt-Doc
    // hat keine .form-field-Huellen, dann traegt das Elternelement die Klasse)
    const wrapper = input?.closest('.form-field') || input?.parentElement;
    if (wrapper?.classList.contains('ai-filled--fact')) return 'fact';
    if (wrapper?.classList.contains('ai-filled--guess')) return 'guess';
    return 'manual';
  }

  applyJobResult(result, { gesendeteKeys, ersetzteKarte }) {
    // 1. Generierte Use Cases an die Liste anhaengen (nur wenn welche kamen -
    //    die Function generiert nur, wenn die gesendete Liste leer war)
    const neueUseCaseKeys = [];
    for (const uc of result.use_cases || []) {
      const key = tempKey('uc');
      this.useCases.push({ key, id: null, name: uc.name, beschreibung: uc.beschreibung || '', deleted: false });
      neueUseCaseKeys.push(key);
    }

    // 2. Index-Mapping: erst die gesendeten (in gesendeter Reihenfolge),
    //    dann die generierten - so hat es die Function referenziert
    const indexZuKey = [...gesendeteKeys, ...neueUseCaseKeys];

    // 3. Karten anlegen
    const basis = ersetzteKarte?.position ?? this.karten.length;
    (result.vorschlaege || []).forEach((v, i) => {
      const payload = v.typ === 'neu'
        ? { ...(v.persona || {}), _luecken_begruendung: v.luecken_begruendung || null }
        : null;

      this.karten.push({
        key: tempKey('karte'),
        id: null,
        typ: v.typ,
        status: 'pending',
        persona_id: v.persona_id || null,
        persona: null, // Match-Details laedt der Drawer bei Bedarf nach
        payload,
        fit_grund: v.fit_grund || '',
        useCaseKeys: (v.use_case_indices || []).map(idx => indexZuKey[idx]).filter(Boolean),
        position: ersetzteKarte ? basis : basis + i,
        persisted: null
      });
    });
  }

  // --- Karten-Aktionen ---

  acceptKarte(key) {
    const karte = this.karten.find(k => k.key === key);
    if (!karte || karte.status !== 'pending') return;
    karte.status = 'accepted';
    this.render();
  }

  zurueckKarte(key) {
    const karte = this.karten.find(k => k.key === key);
    if (!karte || karte.status !== 'accepted') return;
    karte.status = 'pending';
    this.render();
  }

  verwerfKarte(key) {
    const idx = this.karten.findIndex(k => k.key === key);
    if (idx === -1) return;
    const karte = this.karten[idx];
    if (karte.typ === 'match' && karte.persona_id) {
      this.verworfeneMatchIds = [...new Set([...this.verworfeneMatchIds, karte.persona_id])];
    }
    if (karte.id) {
      karte.status = 'deleted';
    } else {
      this.karten.splice(idx, 1);
    }
    this.render();
  }

  regenKarte(key) {
    const karte = this.karten.find(k => k.key === key);
    if (!karte || this.jobRunning) return;
    this.verwerfKarte(key);
    this.startJob('karte', karte);
  }

  acceptAlle() {
    this.karten.forEach(k => { if (k.status === 'pending') k.status = 'accepted'; });
    this.render();
  }

  verwerfAlle() {
    for (const karte of [...this.karten]) {
      if (karte.status !== 'pending') continue;
      if (karte.typ === 'match' && karte.persona_id) {
        this.verworfeneMatchIds = [...new Set([...this.verworfeneMatchIds, karte.persona_id])];
      }
      if (karte.id) {
        karte.status = 'deleted';
      } else {
        this.karten.splice(this.karten.indexOf(karte), 1);
      }
    }
    this.render();
  }

  regenAlle() {
    if (this.jobRunning) return;
    const pending = this.karten.filter(k => k.status === 'pending');
    if (!pending.length && !this.karten.some(k => k.status === 'accepted')) {
      // Keine Karten: wie initial
      this.startJob('initial');
      return;
    }
    for (const karte of pending) {
      if (karte.typ === 'match' && karte.persona_id) {
        this.verworfeneMatchIds = [...new Set([...this.verworfeneMatchIds, karte.persona_id])];
      }
      if (!karte.id) {
        this.karten.splice(this.karten.indexOf(karte), 1);
      } else {
        karte.status = 'deleted';
      }
    }
    this.startJob('alle');
  }

  // --- Use-Case-Liste ---

  addUseCase() {
    this.useCases.push({ key: tempKey('uc'), id: null, name: '', beschreibung: '', deleted: false });
    this.render();
    const rows = this.root()?.querySelectorAll('.produkt-usecases__row');
    const letzte = rows?.[rows.length - 1];
    letzte?.querySelector('.produkt-usecases__name')?.focus();
  }

  removeUseCase(key) {
    const uc = this.useCases.find(u => u.key === key);
    if (!uc) return;
    if (uc.id) {
      uc.deleted = true;
    } else {
      this.useCases.splice(this.useCases.indexOf(uc), 1);
    }
    this.render();
  }

  // --- Events ---

  handleClick(e) {
    const action = e.target.closest('[data-persona-action]');
    if (action) {
      const key = action.closest('[data-key]')?.dataset.key;
      const name = action.dataset.personaAction;

      const aktionen = {
        'accept': () => this.acceptKarte(key),
        'zurueck': () => this.zurueckKarte(key),
        'verwerfen': () => this.verwerfKarte(key),
        'regen-karte': () => this.regenKarte(key),
        'regen-alle': () => this.regenAlle(),
        'accept-alle': () => this.acceptAlle(),
        'verwerf-alle': () => this.verwerfAlle(),
        'add-usecase': () => this.addUseCase(),
        'remove-usecase': () => this.removeUseCase(key)
      };
      aktionen[name]?.();
      return;
    }

    // Karten-Klick (ausserhalb der Fuss-Buttons) oeffnet den Drawer
    const kartenEl = e.target.closest('.persona-card');
    if (kartenEl && !e.target.closest('.persona-card__fuss')) {
      this.openDrawer(kartenEl.dataset.key);
    }
  }

  handleInput(e) {
    const row = e.target.closest('.produkt-usecases__row');
    if (!row) return;
    const uc = this.useCases.find(u => u.key === row.dataset.key);
    if (!uc) return;
    if (e.target.classList.contains('produkt-usecases__name')) uc.name = e.target.value;
    if (e.target.classList.contains('produkt-usecases__beschreibung')) uc.beschreibung = e.target.value;
  }

  async openDrawer(key) {
    const karte = this.karten.find(k => k.key === key);
    if (!karte) return;

    let persona = karte.typ === 'match' ? karte.persona : karte.payload;
    if (karte.typ === 'match' && !persona && karte.persona_id) {
      try {
        const { data, error } = await window.supabase
          .from('personas')
          .select('*')
          .eq('id', karte.persona_id)
          .maybeSingle();
        if (error) throw error;
        persona = data;
        karte.persona = data;
      } catch (err) {
        console.error('Persona konnte nicht geladen werden:', err);
        window.toastSystem?.error?.('Persona konnte nicht geladen werden');
        return;
      }
    }
    if (!persona) return;

    this.drawer.open({
      karte,
      persona,
      unternehmenId: this.kontext?.getUnternehmenId?.() || null
    });
  }

  // --- Save-Flush ---

  getState() {
    return {
      useCases: this.useCases,
      karten: this.karten,
      verworfeneMatchIds: this.verworfeneMatchIds
    };
  }

  /** Nach dem Save: echte IDs und Persistenz-Snapshots uebernehmen. */
  applySavedState({ useCases, karten }) {
    // Alte Client-Keys auf die echten IDs mappen, bevor die Keys wandern
    const altNachNeu = new Map(useCases.map(uc => [uc.key, uc.id]));
    this.useCases = useCases.map(uc => ({ ...uc, key: uc.id }));
    this.karten = karten.map(k => ({
      ...k,
      key: k.id,
      useCaseKeys: (k.useCaseKeys || []).map(key => altNachNeu.get(key) || key).filter(Boolean)
    }));
    this.render();
  }

  /**
   * Flush nur mit geladenem Stand: im Edit-Modus wuerde ein leerer
   * Initialzustand (z.B. nach einem Ladefehler) sonst persistierte
   * Use Cases und Karten wegsynchronisieren.
   */
  isFlushBereit() {
    return !this.produktId || this.loaded;
  }

  /** Gibt es irgendetwas, das der Save schreiben muesste? */
  isDirty() {
    return this.useCases.some(uc => uc.deleted || !uc.id)
      || this.karten.some(k => !k.id || k.status !== k.persisted?.status);
  }

  // --- Render ---

  render() {
    const root = this.root();
    if (!root) return;
    root.innerHTML = `
      <div class="produkt-persona-band">
        <div class="produkt-persona-band__content">
          ${this.renderUseCases()}
          ${this.renderGrid()}
        </div>
        ${this.renderRail()}
      </div>
    `;
  }

  renderUseCases() {
    const liste = this.visibleUseCases();
    const legacy = this.kontext?.legacyEinsatzsituation;

    const rows = liste.map((uc, i) => `
      <li class="produkt-usecases__row" data-key="${uc.key}">
        <span class="produkt-usecases__nr">${i + 1}</span>
        <div class="produkt-usecases__felder">
          <input type="text" class="produkt-usecases__name" value="${escapeHtml(uc.name)}" placeholder="Einsatzsituation, z.B. „Morgens vor der Arbeit"">
          <input type="text" class="produkt-usecases__beschreibung" value="${escapeHtml(uc.beschreibung || '')}" placeholder="Wer nutzt das Produkt hier wann und warum (optional)">
        </div>
        <button type="button" class="produkt-usecases__remove" data-persona-action="remove-usecase" aria-label="Einsatzsituation entfernen">${icon('x-mark')}</button>
      </li>
    `).join('');

    const fallback = !liste.length && legacy
      ? `<p class="produkt-usecases__fallback"><span>Bisheriger Freitext:</span> ${escapeHtml(legacy)}</p>`
      : '';

    return `
      <div class="produkt-usecases">
        <div class="produkt-usecases__head">
          <span class="produkt-usecases__title">Einsatzsituationen</span>
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-persona-action="add-usecase">
            <span class="mdc-btn__icon" aria-hidden="true">${icon('plus-sign')}</span>
            <span class="mdc-btn__label">Hinzufügen</span>
          </button>
        </div>
        ${liste.length ? `<ol class="produkt-usecases__list">${rows}</ol>` : ''}
        ${!liste.length && !legacy ? '<p class="produkt-usecases__leer">Noch keine Einsatzsituationen – sie kommen mit den Persona-Vorschlägen oder per Klick auf „Hinzufügen".</p>' : ''}
        ${fallback}
      </div>
    `;
  }

  renderGrid() {
    const karten = this.aktiveKarten();
    const liste = this.visibleUseCases();

    if (this.jobRunning && !karten.length) {
      return `
        <div class="produkt-persona-grid">
          ${Array.from({ length: 3 }, () => '<div class="persona-card persona-card--skeleton" aria-hidden="true"><div class="persona-card__skeleton-zeile"></div><div class="persona-card__skeleton-zeile persona-card__skeleton-zeile--kurz"></div><div class="persona-card__skeleton-block"></div></div>').join('')}
        </div>
      `;
    }

    if (!karten.length) {
      return `
        <div class="produkt-persona-grid produkt-persona-grid--leer">
          <p class="produkt-persona-grid__leer">Noch keine Persona-Vorschläge. Sobald Name und USP oder Pain Points stehen, kann die KI welche entwerfen.</p>
        </div>
      `;
    }

    return `
      <div class="produkt-persona-grid">
        ${karten.map(karte => this.renderKarte(karte, liste)).join('')}
      </div>
    `;
  }

  renderKarte(karte, useCases) {
    const daten = this.kartenDaten(karte);
    const istMatch = karte.typ === 'match';
    const akzeptiert = karte.status === 'accepted';

    const chips = karte.useCaseKeys
      .map(key => {
        const idx = useCases.findIndex(uc => uc.key === key);
        return idx === -1 ? null : `<span class="persona-card__chip" title="${escapeHtml(useCases[idx].name)}">${idx + 1}</span>`;
      })
      .filter(Boolean)
      .join('');

    return `
      <article class="persona-card${akzeptiert ? ' persona-card--accepted' : ''}" data-key="${karte.key}" tabindex="0" role="button" aria-label="Persona-Details öffnen">
        <header class="persona-card__kopf">
          <span class="persona-card__name">${escapeHtml(daten.name)}${daten.alter ? `, ${escapeHtml(daten.alter)}` : ''}</span>
          <span class="tag persona-card__badge ${istMatch ? 'persona-card__badge--match' : 'persona-card__badge--neu'}">${istMatch ? 'Bekannte Persona' : 'Neuer Vorschlag'}</span>
        </header>
        ${daten.oberbegriff ? `<p class="persona-card__sub">${escapeHtml(daten.oberbegriff)}</p>` : ''}
        ${daten.text ? `<p class="persona-card__text">${escapeHtml(daten.text)}</p>` : ''}
        ${chips ? `<div class="persona-card__chips"><span class="persona-card__chips-label">Passt zu:</span>${chips}</div>` : ''}
        <footer class="persona-card__fuss">
          ${akzeptiert
            ? `<button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-persona-action="zurueck"><span class="mdc-btn__label">Zurücknehmen</span></button>`
            : `<button type="button" class="mdc-btn mdc-btn--primary mdc-btn--sm" data-persona-action="accept"><span class="mdc-btn__label">Annehmen</span></button>`}
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-persona-action="regen-karte" ${this.jobRunning ? 'disabled' : ''}>
            <span class="mdc-btn__label">Neu generieren</span>
          </button>
          <button type="button" class="mdc-btn mdc-btn--cancel mdc-btn--sm" data-persona-action="verwerfen">
            <span class="mdc-btn__label">Verwerfen</span>
          </button>
        </footer>
      </article>
    `;
  }

  renderRail() {
    const karten = this.aktiveKarten();
    const pending = karten.filter(k => k.status === 'pending');
    const gateOk = this.hasSubstance();
    const hatKarten = karten.length > 0;

    const hinweis = hatKarten
      ? 'Persona-Vorschläge sind noch nicht gespeichert. Akzeptierte Personas werden beim Speichern des Produkts angelegt und verknüpft.'
      : 'Die KI schlägt Einsatzsituationen und passende Personas vor – bestehende der Marke bei echtem Fit, neue bei echten Lücken.';

    return `
      <aside class="produkt-persona-rail">
        <button type="button" class="mdc-btn mdc-btn--primary" data-persona-action="regen-alle"
          ${this.jobRunning || !gateOk ? 'disabled' : ''}
          title="${gateOk ? 'Alle offenen Karten neu generieren' : 'Erst Name plus USP, Pain Points oder Kurzbeschreibung ausfüllen'}">
          <span class="mdc-btn__icon" aria-hidden="true">${icon('arrow-path')}</span>
          <span class="mdc-btn__label">${this.jobRunning ? 'Generiert…' : 'Neu generieren'}</span>
        </button>
        <button type="button" class="mdc-btn mdc-btn--secondary" data-persona-action="accept-alle" ${!pending.length || this.jobRunning ? 'disabled' : ''}>
          <span class="mdc-btn__icon" aria-hidden="true">${icon('check-bold')}</span>
          <span class="mdc-btn__label">Alle annehmen</span>
        </button>
        <button type="button" class="mdc-btn mdc-btn--cancel" data-persona-action="verwerf-alle" ${!pending.length || this.jobRunning ? 'disabled' : ''}>
          <span class="mdc-btn__label">Alle verwerfen</span>
        </button>
        <p class="produkt-persona-rail__hint">${hinweis}</p>
      </aside>
    `;
  }

  destroy() {
    if (this._abort) {
      try { this._abort.abort(); } catch (_) { /* noop */ }
      this._abort = null;
    }
    this.drawer.remove();
  }
}
