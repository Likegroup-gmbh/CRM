// ProduktPersonaPanel.js
// Einsatzsituationen (hinter dem Inhalt) und Personas (ganz unten) im
// Produkt-Worksheet. Zwei Slots, ein Panel: Use-Case-Liste und Karten-Grid
// mit Icon-Aktionen (einzeln und alle).
//
// Startrun: genau eine neue, breite Persona. Weitere nur bewusst (+1 KI
// oder manuell). Regen ersetzt pending KI-Karten, manuelle Matches bleiben.
//
// Der Stand lebt im Speicher. Uebernehmen im Drawer legt die Persona
// sofort an. Der Produkt-Save schreibt den Vorschlags-Link.
// Pending-Karten blocken den Save per Toast.
//
// Trigger: automatisch nach einem Site-Extract (siteExtractFinished), aber
// nur wenn noch keine Karten existieren. Sonst per Icon, sobald das
// Substance-Gate steht (Name + USP/Pains/Kurzbeschreibung).

import { ProduktPersonaService } from './ProduktPersonaService.js';
import { ProduktPersonaDrawer } from './ProduktPersonaDrawer.js';
import { PersonaService } from '../persona/PersonaService.js';
import { toggleRelationSuche } from '../../core/components/EntitySearchInput.js';
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

function iconBtn(action, iconKey, label, { disabled = false, active = false } = {}) {
  const cls = `rel-icon-btn${active ? ' rel-icon-btn--active' : ''}`;
  return `<button type="button" class="${cls}" data-persona-action="${action}"${disabled ? ' disabled' : ''}${active ? ' aria-pressed="true"' : ''} title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${icon(iconKey)}</button>`;
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
    this.loaded = false; // mount() setzt den Create-Modus auf sofort bereit
    this.drawer = new ProduktPersonaDrawer();
    this.suche = null;
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

    const form = this.form;
    if (!form) return;

    form.addEventListener('click', (e) => this.handleClick(e), opts);
    form.addEventListener('input', (e) => this.handleInput(e), opts);
  }

  root() {
    return this.form?.querySelector('#produkt-persona-panel');
  }

  usecasesRoot() {
    return this.form?.querySelector('#produkt-usecases-panel');
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
    return {
      name: quelle.name || 'Persona',
      oberbegriff: quelle.oberbegriff || '',
      text: quelle.beschreibung || quelle.pain_points || karte.fit_grund || ''
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

    const behalten = this.aktiveKarten()
      .map(k => ({ typ: k.typ, name: this.kartenDaten(k).name }));

    const input = {
      modus,
      felder: this.buildJobFelder(),
      marke_ids: this.kontext?.getMarkeIds?.() || [],
      bestehende_use_cases: gesendeteUseCases.map(uc => ({ name: uc.name, beschreibung: uc.beschreibung || null })),
      ausschluss_persona_ids: [...ausschluss],
      behalten,
      anzahlZiel: 1,
      ersetzteKarte: ersetzteKarte ? { typ: ersetzteKarte.typ } : null
    };

    try {
      const result = await ProduktPersonaService.starteJob({
        produktId: this.produktId,
        unternehmenId: this.kontext?.getUnternehmenId?.() || null,
        input
      });
      this.applyJobResult(result, { gesendeteKeys, ersetzteKarte });
      window.toastSystem?.success?.('Persona-Vorschlag ist da');
    } catch (err) {
      console.error('Persona-Generierung fehlgeschlagen:', err);
      window.toastSystem?.error?.(err.message || 'Persona-Vorschläge fehlgeschlagen');
      // Der Nutzer kann neu generieren. Kein automatisches Zurueckholen.
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

  /**
   * Bestehende Persona manuell anhaengen - die KI bleibt der Hauptweg, aber
   * bekannte Personas muessen ohne Generierung verlinkbar sein (gleiche
   * Inline-Suche wie das Produkte-Band an der Persona).
   */
  toggleSuche() {
    toggleRelationSuche(this, {
      placeholder: 'Personas suchen und hinzufügen...',
      emptyText: 'Keine Personas gefunden',
      search: (unternehmenId, term) => this.suchePersonas(unternehmenId, term),
      onSelect: (item) => this.addPersonaKarte(item)
    });
  }

  async suchePersonas(unternehmenId, term) {
    const belegt = this.karten
      .filter(k => k.status !== 'deleted' && k.persona_id)
      .map(k => k.persona_id);
    const treffer = await PersonaService.searchByName(unternehmenId, term, {
      excludeIds: [...new Set([...belegt, ...this.verworfeneMatchIds])]
    });
    return treffer.map(p => ({
      id: p.id,
      label: p.name || 'Persona',
      sub: p.oberbegriff || '',
      data: p
    }));
  }

  /**
   * Manuell gewaehlte Persona als Match-Karte. Uebernehmen passiert im
   * Drawer; hier landet sie erstmal pending, damit der Save-Toast greift.
   */
  addPersonaKarte(item) {
    if (this.karten.some(k => k.status !== 'deleted' && k.persona_id === item.id)) return;
    this.karten.push({
      key: tempKey('karte'),
      id: null,
      typ: 'match',
      status: 'pending',
      persona_id: item.id,
      persona: item.data || null,
      payload: null,
      fit_grund: '',
      useCaseKeys: [],
      position: this.karten.length,
      persisted: null
    });
    this.render();
  }

  async zurueckKarte(key) {
    const karte = this.karten.find(k => k.key === key);
    if (!karte || karte.status !== 'accepted') return;
    try {
      const next = await ProduktPersonaService.zuruecknehmen(karte, {
        produktId: this.produktId
      });
      Object.assign(karte, next);
      this.render();
    } catch (err) {
      console.error('Zurücknehmen fehlgeschlagen:', err);
      window.toastSystem?.error?.(err.message || 'Zurücknehmen fehlgeschlagen');
    }
  }

  async verwerfKarte(key) {
    const idx = this.karten.findIndex(k => k.key === key);
    if (idx === -1) return;
    const karte = this.karten[idx];
    try {
      if (karte.status === 'accepted') {
        await ProduktPersonaService.zuruecknehmen(karte, { produktId: this.produktId });
      }
    } catch (err) {
      console.error('Verwerfen fehlgeschlagen:', err);
      window.toastSystem?.error?.(err.message || 'Verwerfen fehlgeschlagen');
      return;
    }
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
    if (!karte || this.jobRunning || karte.status === 'accepted' || karte.typ === 'match') return;
    void this.verwerfKarte(key).then(() => this.startJob('karte', karte));
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
    const aktive = this.aktiveKarten();
    const pendingKi = this.karten.filter(k => k.status === 'pending' && k.typ === 'neu');
    if (!aktive.length) {
      this.startJob('initial');
      return;
    }
    if (pendingKi.length && !aktive.some(k => k.status === 'accepted')) {
      for (const karte of pendingKi) {
        if (karte.id) {
          karte.status = 'deleted';
        } else {
          this.karten.splice(this.karten.indexOf(karte), 1);
        }
      }
      this.startJob('initial');
    }
  }

  weitereVorschlagen() {
    if (this.jobRunning) return;
    if (this.aktiveKarten().length >= MAX_KARTEN) {
      window.toastSystem?.warning?.('Höchstens 6 Personas am Produkt');
      return;
    }
    this.startJob('weitere');
  }

  // --- Use-Case-Liste ---

  addUseCase() {
    this.useCases.push({ key: tempKey('uc'), id: null, name: '', beschreibung: '', deleted: false });
    this.render();
    const rows = this.usecasesRoot()?.querySelectorAll('.produkt-usecases__row');
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
        'open': () => this.openDrawer(key),
        'add-persona': () => this.toggleSuche(),
        'zurueck': () => this.zurueckKarte(key),
        'verwerfen': () => this.verwerfKarte(key),
        'regen-karte': () => this.regenKarte(key),
        'regen-alle': () => this.regenAlle(),
        'weitere': () => this.weitereVorschlagen(),
        'verwerf-alle': () => this.verwerfAlle(),
        'add-usecase': () => this.addUseCase(),
        'remove-usecase': () => this.removeUseCase(key)
      };
      aktionen[name]?.();
      return;
    }

    const card = e.target.closest('.rel-card[data-key]');
    if (card && this.root()?.contains(card)) {
      this.openDrawer(card.dataset.key);
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
    if (karte.typ === 'match' && karte.persona_id) {
      try {
        const data = await PersonaService.loadOne(karte.persona_id, {
          unternehmenId: this.kontext?.getUnternehmenId?.() || null
        });
        if (!data) {
          window.toastSystem?.error?.('Persona konnte nicht geladen werden');
          return;
        }
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
      unternehmenId: this.kontext?.getUnternehmenId?.() || null,
      markeIds: this.kontext?.getMarkeIds?.() || [],
      produktId: this.produktId,
      onChange: (next) => this.applyKarte(next)
    });
  }

  applyKarte(next) {
    if (!next?.key) return;
    const idx = this.karten.findIndex(k => k.key === next.key);
    if (idx === -1) return;
    this.karten[idx] = { ...this.karten[idx], ...next };
    this.render();
  }

  pendingKarten() {
    return this.aktiveKarten().filter(k => k.status === 'pending');
  }

  /** Text fuer den Save-Block, oder null wenn Speichern ok ist. */
  saveBlockGrund() {
    if (this.jobRunning) {
      return 'Persona-Vorschläge werden noch generiert. Bitte warten.';
    }
    const n = this.pendingKarten().length;
    if (!n) return null;
    return n === 1
      ? 'Noch 1 Persona-Vorschlag nicht übernommen. Übernehmen legt sie unter Personas an — Speichern allein reicht nicht.'
      : `Noch ${n} Persona-Vorschläge nicht übernommen. Übernehmen legt sie unter Personas an — Speichern allein reicht nicht.`;
  }

  scrollIntoView() {
    this.root()?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    const usecases = this.usecasesRoot();
    if (usecases) usecases.innerHTML = this.renderUseCases();

    const root = this.root();
    if (root) root.innerHTML = this.renderPersonas();
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

  renderPersonas() {
    const karten = this.aktiveKarten();
    const pending = karten.filter(k => k.status === 'pending');
    const pendingKi = pending.filter(k => k.typ === 'neu');
    const hatAccepted = karten.some(k => k.status === 'accepted');
    const gateOk = this.hasSubstance();
    const kannStartrun = !karten.length;
    const kannReplace = pendingKi.length > 0 && !hatAccepted;
    const regenLabel = this.jobRunning
      ? 'Generiert…'
      : (gateOk ? 'Neu generieren' : 'Erst Name plus USP, Pain Points oder Kurzbeschreibung ausfüllen');
    const regenDisabled = this.jobRunning || !gateOk || (!kannStartrun && !kannReplace);
    const weitereDisabled = this.jobRunning || !gateOk || !karten.length || karten.length >= MAX_KARTEN;
    const skeleton = '<div class="rel-card rel-card--skeleton" aria-hidden="true"><div class="rel-card__skeleton-zeile"></div><div class="rel-card__skeleton-zeile rel-card__skeleton-zeile--kurz"></div><div class="rel-card__skeleton-block"></div></div>';

    let body;
    if (this.jobRunning && !karten.length) {
      body = `
        <div class="rel-grid">
          ${skeleton}
        </div>
      `;
    } else if (!karten.length) {
      body = `
        <div class="rel-grid rel-grid--leer">
          <p class="rel-grid__leer">Noch keine Personas verknüpft. Über die Suche oben rechts hinzufügen – oder von der KI welche entwerfen lassen, sobald Name und USP oder Pain Points stehen.</p>
        </div>
      `;
    } else {
      body = `
        <div class="rel-grid">
          ${karten.map(karte => this.renderKarte(karte)).join('')}
          ${this.jobRunning ? skeleton : ''}
        </div>
      `;
    }

    return `
      <div class="rel-panel">
        <div class="rel-panel__head">
          <span class="rel-panel__title">Personas</span>
          <div class="rel-panel__aktionen">
            ${iconBtn('add-persona', 'plus-sign', 'Bestehende Persona hinzufügen', { disabled: this.jobRunning })}
            ${iconBtn('regen-alle', 'arrow-path', regenLabel, { disabled: regenDisabled })}
            ${iconBtn('weitere', 'sparkles', 'Weitere vorschlagen', { disabled: weitereDisabled })}
            ${iconBtn('verwerf-alle', 'trash', 'Alle verwerfen', { disabled: !pending.length || this.jobRunning })}
          </div>
        </div>
        <div class="rel-panel__suche"></div>
        ${body}
      </div>
    `;
  }

  renderKarte(karte) {
    const daten = this.kartenDaten(karte);
    const akzeptiert = karte.status === 'accepted';
    const matchLesen = akzeptiert && karte.typ === 'match';

    return `
      <article class="rel-card${akzeptiert ? ' rel-card--accepted' : ''}" data-key="${karte.key}">
        <header class="rel-card__kopf">
          <span class="rel-card__name">${escapeHtml(daten.name)}</span>
          <div class="rel-card__aktionen">
            ${iconBtn('open', matchLesen ? 'document-text' : 'pencil-square', matchLesen ? 'Details öffnen' : 'Bearbeiten')}
            ${akzeptiert ? iconBtn('zurueck', 'check-bold', 'Zurücknehmen', { active: true }) : ''}
            ${iconBtn('regen-karte', 'arrow-path', 'Neu generieren', { disabled: this.jobRunning || akzeptiert || karte.typ === 'match' })}
            ${iconBtn('verwerfen', 'trash', 'Verwerfen')}
          </div>
        </header>
        ${daten.oberbegriff ? `<p class="rel-card__sub">${escapeHtml(daten.oberbegriff)}</p>` : ''}
        ${daten.text ? `<p class="rel-card__text"><span class="rel-card__label">Situation / Alltag:</span> ${escapeHtml(daten.text)}</p>` : ''}
      </article>
    `;
  }

  destroy() {
    this.suche?.destroy();
    this.suche = null;
    if (this._abort) {
      try { this._abort.abort(); } catch (_) { /* noop */ }
      this._abort = null;
    }
    this.drawer.remove();
  }
}
