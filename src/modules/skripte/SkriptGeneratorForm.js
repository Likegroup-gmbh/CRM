// SkriptGeneratorForm.js
// Wiederverwendbares Generator-Formular (Kontext + Videovorlage + Video-Vorgaben)
// mit Kaskade Unternehmen -> Marke -> Kampagne/Produkt/Persona.
// Videovorlage kommt aus strategie_items der gewaehlten Kampagne.

import { skripteService } from './SkripteService.js';
import { escapeHtml } from './SkripteUtils.js';
import { BEREICH_LABELS } from '../briefing/create/fieldConfig.js';
import { PersonaService } from '../persona/PersonaService.js';
import { buildSkriptVorlagePickerOptions } from '../strategie/strategieItemPicker.js';
import { generatorFormMarkup } from './SkriptGeneratorFormMarkup.js';
import { applyStrategieItem, buildReferenzVideoPayload } from './strategieVorlage.js';

export { applyStrategieItem, buildReferenzVideoPayload };

export class SkriptGeneratorForm {
  constructor({ prefix = 'gen' } = {}) {
    this.prefix = prefix;
    this.container = null;
    this.unternehmen = [];
    this.marken = [];
    this.strategieItems = [];
    this.ideeFromItem = '';
    this.referenz = { itemId: null, item: null };
  }

  el(name) {
    return this.container?.querySelector(`#${this.prefix}-${name}`) || null;
  }

  async render(container) {
    this.container = container;
    container.innerHTML = generatorFormMarkup(this.prefix);

    this.el('unternehmen').addEventListener('change', () => this.onUnternehmenChange());
    this.el('marke').addEventListener('change', () => this.onMarkeChange());
    this.el('kampagne').addEventListener('change', () => this.onKampagneChange());
    this.bindReferenzEvents();
    this.initDisabledDependents();

    await Promise.all([this.loadUnternehmen(), this.loadBranchen(), this.loadDnaOptionen()]);
  }

  // ------------------------------------------------------------------
  // Searchable Select (gleicher Wrapper wie Videovorlage)
  // ------------------------------------------------------------------
  refreshSearchableSelect(name, options, { placeholder, emptyLabel }) {
    const select = this.el(name);
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${emptyLabel}</option>`
      + options.map((o) => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join('');
    if (current) select.value = current;
    if (!window.formSystem?.createSimpleSearchableSelect) return;
    window.formSystem.createSimpleSearchableSelect(select, [
      { value: '', label: emptyLabel },
      ...options.map((o) => ({ ...o, selected: o.value === current }))
    ], { placeholder });
  }

  setSearchableValue(name, value) {
    const select = this.el(name);
    if (!select) return;
    select.value = value || '';
    const label = select.selectedOptions[0]?.textContent || '';
    const wrap = select.parentNode?.querySelector('.searchable-select-container');
    const hidden = wrap?.querySelector('input[type="hidden"]');
    const input = wrap?.querySelector('.searchable-select-input');
    if (hidden) hidden.value = value || '';
    if (input) input.value = value ? label : '';
  }

  initDisabledDependents() {
    const empty = '– Erst Unternehmen wählen –';
    this.refreshSearchableSelect('marke', [], { placeholder: 'Marke suchen…', emptyLabel: empty });
    this.refreshSearchableSelect('kampagne', [], { placeholder: 'Kampagne suchen…', emptyLabel: empty });
    this.refreshSearchableSelect('produkt', [], { placeholder: 'Produkt suchen…', emptyLabel: empty });
    this.refreshSearchableSelect('persona', [], { placeholder: 'Persona suchen…', emptyLabel: empty });
    this.refreshSearchableSelect('briefing', [], { placeholder: 'Briefing suchen…', emptyLabel: empty });
    this.refreshSearchableSelect('ref-item', [], {
      placeholder: 'Strategie-Video suchen…',
      emptyLabel: '– Erst Kampagne wählen –'
    });
  }

  // ------------------------------------------------------------------
  // Videovorlage: Strategie-Item der Kampagne
  // ------------------------------------------------------------------
  bindReferenzEvents() {
    this.el('ref-item')?.addEventListener('change', () => this.onRefItemChange());
    this.el('ref-clear')?.addEventListener('click', () => this.resetReferenz());
  }

  applyItemToFields(item) {
    const next = applyStrategieItem(item, {
      idee: this.el('idee')?.value,
      previousIdeeFromItem: this.ideeFromItem
    });
    this.ideeFromItem = next.ideeFromItem;
    const ideeEl = this.el('idee');
    if (ideeEl) ideeEl.value = next.idee;
    const setzen = (name, wert) => { const el = this.el(name); if (el) el.value = wert || ''; };
    setzen('ref-transkript', next.transkript);
    setzen('ref-beschreibung', next.beschreibung);
    setzen('ref-caption', next.caption);
    this.referenz = { itemId: next.itemId, item };
    this.renderReferenzState();
    this.renderReferenzMeta(item);
  }

  async onRefItemChange() {
    const id = this.el('ref-item')?.value || '';
    const basis = this.strategieItems.find((i) => i.id === id) || null;
    if (!basis) {
      this.applyItemToFields(null);
      return;
    }
    // Transkript/Caption laedt der Picker nicht mit - erst beim Select
    // (der Server ist ohnehin Autoritaet fuer das Transkript, hier geht
    // es um die editierbare Vorschau)
    try {
      const item = await skripteService.loadStrategieItem(id);
      this.applyItemToFields(item || basis);
    } catch (err) {
      window.toastSystem?.error(err.message);
      this.applyItemToFields(basis);
    }
  }

  renderReferenzState() {
    const result = this.el('ref-result');
    if (result) result.hidden = !this.referenz.itemId;
    const source = this.el('ref-source');
    if (source) {
      source.textContent = this.referenz.itemId ? '(aus Strategie – prüfen/anpassen möglich)' : '';
    }
  }

  renderReferenzMeta(item) {
    const el = this.el('ref-meta');
    if (!el) return;
    el.textContent = '';
    if (!item) { el.hidden = true; return; }

    const chips = [
      item.creator_name || null,
      item.plattform === 'tiktok' ? 'TikTok' : item.plattform === 'instagram' ? 'Instagram' : item.plattform || null
    ].filter(Boolean);

    if (!chips.length) { el.hidden = true; return; }
    for (const text of chips) {
      const chip = document.createElement('span');
      chip.className = 'skripte-ref-chip';
      chip.textContent = text;
      el.appendChild(chip);
    }
    el.hidden = false;
  }

  resetReferenz() {
    this.setSearchableValue('ref-item', '');
    this.applyItemToFields(null);
  }

  refreshRefItemSelect(options) {
    const select = this.el('ref-item');
    if (!select) return;
    const emptyLabel = select.disabled
      ? '– Erst Kampagne wählen –'
      : (options.length ? '– Keins –' : '– Keine Strategie-Videos –');
    this.refreshSearchableSelect('ref-item', options, {
      placeholder: 'Strategie-Video suchen…',
      emptyLabel
    });
  }

  async loadStrategieVorlagen() {
    const kampagneId = this.el('kampagne')?.value || null;
    const select = this.el('ref-item');
    const hint = this.el('ref-hint');
    if (!select) return;

    this.applyItemToFields(null);

    if (!kampagneId) {
      this.strategieItems = [];
      select.disabled = true;
      this.refreshRefItemSelect([]);
      if (hint) hint.textContent = 'Wähle eine Kampagne, dann ein Video aus deren Strategie.';
      return;
    }

    const items = await skripteService.loadStrategieItems(kampagneId);
    this.strategieItems = items;
    const options = buildSkriptVorlagePickerOptions(items);
    select.disabled = options.length === 0;
    this.refreshRefItemSelect(options);

    if (hint) {
      hint.textContent = options.length
        ? 'Liky nutzt Aufbau und Machart als Vorlage; die Video-Idee kommt aus der Beschreibung.'
        : 'Keine Strategie-Videos für diese Kampagne.';
    }
  }

  getReferenzPayload() {
    return buildReferenzVideoPayload({
      strategieItemId: this.el('ref-item')?.value || this.referenz.itemId,
      url: this.referenz.item?.video_link,
      transkript: this.el('ref-transkript')?.value,
      beschreibung: this.el('ref-beschreibung')?.value,
      caption: this.el('ref-caption')?.value,
      platform: this.referenz.item?.plattform
    });
  }

  destroy() {}

  // ------------------------------------------------------------------
  // Campaign-Briefing: kaskadiert nach Unternehmen / Marke
  // ------------------------------------------------------------------
  async loadBriefings() {
    const unternehmenId = this.el('unternehmen')?.value || null;
    const markeId = this.el('marke')?.value || null;
    const select = this.el('briefing');
    const hint = this.el('briefing-hint');
    if (!select) return;

    if (!unternehmenId) {
      select.disabled = true;
      this.refreshSearchableSelect('briefing', [], {
        placeholder: 'Briefing suchen…',
        emptyLabel: '– Erst Unternehmen wählen –'
      });
      if (hint) hint.textContent = 'Wähle zuerst ein Unternehmen, dann ein Campaign-Briefing.';
      return;
    }

    const briefings = await skripteService.loadBriefings(unternehmenId, markeId || null);
    select.disabled = false;
    this.refreshSearchableSelect('briefing', briefings.map((b) => {
      const bereich = BEREICH_LABELS[b.bereich] || '';
      const name = b.aktivierung_name || 'Unbenanntes Briefing';
      return { value: b.id, label: bereich ? `${name} (${bereich})` : name };
    }), { placeholder: 'Briefing suchen…', emptyLabel: '– Keins –' });

    if (hint) {
      if (!briefings.length) {
        hint.innerHTML = 'Noch kein Briefing – <a href="/briefing">im Briefing-Generator anlegen</a>.';
        hint.querySelector('a')?.addEventListener('click', (e) => {
          e.preventDefault();
          window.navigateTo?.('/briefing');
        });
      } else {
        hint.textContent = 'Liky nutzt die Angaben als verbindliche Basis für das Skript.';
      }
    }
  }

  async loadUnternehmen() {
    this.unternehmen = await skripteService.loadUnternehmen();
    this.refreshSearchableSelect('unternehmen', this.unternehmen.map((u) => ({
      value: u.id,
      label: u.firmenname
    })), { placeholder: 'Unternehmen suchen…', emptyLabel: '– Unternehmen wählen –' });
  }

  async loadPersonas() {
    const select = this.el('persona');
    if (!select) return;

    const unternehmenId = this.el('unternehmen')?.value || null;
    const markeId = this.el('marke')?.value || null;

    if (!unternehmenId) {
      select.disabled = true;
      this.refreshSearchableSelect('persona', [], {
        placeholder: 'Persona suchen…',
        emptyLabel: '– Erst Unternehmen wählen –'
      });
      return;
    }

    // Persona-Quelle hier ist bewusst PersonaService.loadForContext
    // (kontext-gefiltert auf Unternehmen/Marke - der Generator soll nur
    // passende Personas anbieten). Die DNA-Ansicht nutzt dagegen den
    // globalen skripteService.loadPersonas, weil sie Personas als
    // DNA-Scope zuordnet. Unterschiedliche Semantik, nicht mergen -
    // SkriptGeneratorForm.test.js sichert die Trennung ab.
    const personas = markeId
      ? await PersonaService.loadForContext({ markeId })
      : await PersonaService.loadForContext({ unternehmenId });

    select.disabled = false;
    this.refreshSearchableSelect('persona', personas.map((p) => ({
      value: p.id,
      label: skripteService.personaLabel(p)
    })), { placeholder: 'Persona suchen…', emptyLabel: '– Keine –' });
  }

  async loadBranchen() {
    const branchen = await skripteService.loadBranchen();
    this.refreshSearchableSelect('branche', branchen.map((b) => ({
      value: b.id,
      label: b.name
    })), { placeholder: 'Branche suchen…', emptyLabel: '– Keine –' });
  }

  async loadDnaOptionen() {
    const dokumente = await skripteService.loadAktiveDna();
    const select = this.el('dna');
    if (!select) return;

    const scopeLabel = (d) => {
      if (d.layer_typ === 'branche') return d.branchen?.name;
      if (d.layer_typ === 'zielgruppe') return d.personas ? skripteService.personaLabel(d.personas) : null;
      if (d.layer_typ === 'marke') return d.marke?.markenname;
      return null;
    };

    select.innerHTML = '<option value="auto">Automatisch (passende aktive Layer)</option>'
      + '<option value="ohne">Ohne DNA (Blindvergleich)</option>'
      + dokumente.map((d) => {
        const scope = scopeLabel(d);
        const label = d.name || `${d.layer_typ}${scope ? `: ${scope}` : ''} v${d.version}`;
        return `<option value="${d.id}">${escapeHtml(label)}${d.name && scope ? ` (${escapeHtml(scope)})` : ''}</option>`;
      }).join('');
  }

  async onUnternehmenChange() {
    const unternehmenId = this.el('unternehmen').value;
    const markeSelect = this.el('marke');

    if (!unternehmenId) {
      if (markeSelect) markeSelect.disabled = true;
      this.refreshSearchableSelect('marke', [], {
        placeholder: 'Marke suchen…',
        emptyLabel: '– Erst Unternehmen wählen –'
      });
      await Promise.all([
        this.loadKampagnenUndProdukte(),
        this.loadPersonas(),
        this.loadBriefings(),
        this.loadStrategieVorlagen()
      ]);
      return;
    }

    const unternehmen = this.unternehmen.find((u) => u.id === unternehmenId);
    if (unternehmen?.branche_id) this.setSearchableValue('branche', unternehmen.branche_id);

    this.marken = await skripteService.loadMarken(unternehmenId);
    if (markeSelect) markeSelect.disabled = false;
    this.refreshSearchableSelect('marke', this.marken.map((m) => ({
      value: m.id,
      label: m.markenname
    })), {
      placeholder: 'Marke suchen…',
      emptyLabel: this.marken.length ? '– Keine –' : '– Keine Marke vorhanden –'
    });

    // Vorlagen haengen an der Kampagne - nur neu laden, wenn die
    // Kampagnen-Auswahl durch den Kontextwechsel kippt
    const kampagneVorher = this.el('kampagne')?.value || null;
    await Promise.all([
      this.loadKampagnenUndProdukte(),
      this.loadBriefings(),
      this.loadPersonas()
    ]);
    if ((this.el('kampagne')?.value || null) !== kampagneVorher) {
      await this.loadStrategieVorlagen();
    }
  }

  async onMarkeChange() {
    const markeId = this.el('marke').value;
    const marke = this.marken.find((m) => m.id === markeId);
    if (marke?.branche_id) this.setSearchableValue('branche', marke.branche_id);

    // Nur geaenderte Zweige neu laden: Kampagnen/Briefings/Personas haengen
    // an der Marke, die Strategie-Vorlagen an der (evtl. unveraenderten)
    // Kampagne
    const kampagneVorher = this.el('kampagne')?.value || null;
    await Promise.all([
      this.loadKampagnenUndProdukte(),
      this.loadBriefings(),
      this.loadPersonas()
    ]);
    if ((this.el('kampagne')?.value || null) !== kampagneVorher) {
      await this.loadStrategieVorlagen();
    }
  }

  async onKampagneChange() {
    await this.loadStrategieVorlagen();
  }

  /**
   * Kampagnen/Produkte passend zum Kontext laden: mit Marke nach Marke
   * gefiltert, ohne Marke faellt die Filterung aufs Unternehmen zurueck
   * (z.B. wenn das Unternehmen gar keine Marke hat).
   */
  async loadKampagnenUndProdukte() {
    const unternehmenId = this.el('unternehmen')?.value || null;
    const markeId = this.el('marke')?.value || null;
    const kampagneSelect = this.el('kampagne');
    const produktSelect = this.el('produkt');
    if (!kampagneSelect || !produktSelect) return;

    if (!unternehmenId) {
      kampagneSelect.disabled = true;
      produktSelect.disabled = true;
      this.refreshSearchableSelect('kampagne', [], {
        placeholder: 'Kampagne suchen…',
        emptyLabel: '– Erst Unternehmen wählen –'
      });
      this.refreshSearchableSelect('produkt', [], {
        placeholder: 'Produkt suchen…',
        emptyLabel: '– Erst Unternehmen wählen –'
      });
      return;
    }

    const filter = { markeId, unternehmenId };
    const [kampagnen, produkte] = await Promise.all([
      skripteService.loadKampagnen(filter),
      skripteService.loadProdukte(filter)
    ]);

    kampagneSelect.disabled = false;
    this.refreshSearchableSelect('kampagne', kampagnen.map((k) => ({
      value: k.id,
      label: k.eigener_name || k.kampagnenname || k.id
    })), { placeholder: 'Kampagne suchen…', emptyLabel: '– Keine –' });

    produktSelect.disabled = false;
    this.refreshSearchableSelect('produkt', produkte.map((p) => ({
      value: p.id,
      label: p.name
    })), { placeholder: 'Produkt suchen…', emptyLabel: '– Keins –' });
  }

  /** Payload fuer skript-generate-background. Wirft Error bei fehlenden Pflichtfeldern. */
  getPayload() {
    const unternehmenId = this.el('unternehmen')?.value;
    const videoIdee = this.el('idee')?.value.trim();

    if (!unternehmenId) throw new Error('Bitte ein Unternehmen wählen');
    if (!videoIdee) throw new Error('Bitte eine Video-Idee eingeben');

    const referenzVideo = this.getReferenzPayload();
    const strategieItemId = this.el('ref-item')?.value || this.referenz.itemId || null;

    const dnaWahl = this.el('dna').value;
    return {
      referenz_video: referenzVideo,
      unternehmen_id: unternehmenId,
      marke_id: this.el('marke').value || null,
      kampagne_id: this.el('kampagne').value || null,
      produkt_id: this.el('produkt').value || null,
      persona_id: this.el('persona').value || null,
      branche_id: this.el('branche').value || null,
      briefing_id: this.el('briefing')?.value || null,
      strategie_item_id: strategieItemId,
      video_idee: videoIdee,
      location: this.el('location').value.trim() || null,
      regieanweisung: this.el('regie').value.trim() || null,
      video_laenge: this.el('laenge').value || null,
      funnel_stufe: this.el('funnel').value || null,
      tonalitaet: this.el('tonalitaet').value.trim() || null,
      mit_dna: dnaWahl !== 'ohne',
      dna_id: dnaWahl !== 'auto' && dnaWahl !== 'ohne' ? dnaWahl : null
    };
  }
}
