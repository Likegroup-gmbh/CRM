// KonzeptEinreichungDrawer.js
// Review einer Konzept-Einreichung (ADR 0059): der Videoidee-Drawer, vorbelegt aus dem Creator-Sheet.
// Editierbar sind Titel, Kurzbeschreibung, Hook, Ablauf und Einordnung (Casting-Eintrag, Kategorie,
// Funnel-Stufe, Persona, Produkt, Dauer). Der Block „Creator-Sheet“ bleibt unverändert, wie der
// Creator ihn geschrieben hat (ADR 0055: Abgeschicktes bleibt). Anlegen schreibt genau eine Videoidee
// (Typ Idee) und markiert die Einreichung als angelegt.
//
// Der Drawer erbt vom AddItemDrawer: Select-Felder, Dauer-Slider und Schließen sind dieselben.

import { AddItemDrawer } from './AddItemDrawer.js';
import { strategieService } from './StrategieService.js';
import { buildStrategieItemInsert } from './addItemPayload.js';
import { loadStrategiePersonas, strategiePersonaOptions } from './strategiePersonaOptions.js';
import { normalisiereStruktur, strukturZuText } from './videoidee/beschreibungStruktur.js';
import { konzeptSheetBloecke } from '../einladung/konzeptSheet.js';
import { ladeEinreichung, markiereKonzeptAngelegt } from '../einladung/einreichungService.js';
import {
  bindSekundenSpanne,
  sekundenSpanneWert,
  setSekundenSpanne
} from '../../core/components/SekundenSpanne.js';

const OHNE_EINTRAG = 'Ohne Zuordnung';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Casting-Einträge des Konzepts, aus denen die Videoidee ihren Eintrag bekommt: nicht abgesagt,
 * nicht abgelehnt, nicht unter „Nicht umsetzen“. Der Eintrag der Einladung bleibt immer wählbar.
 */
export async function ladeEintragOptionen(strategie, vorgewaehlt = null) {
  if (!strategie?.creator_auswahl_id || !window.supabase) return [];
  const { data, error } = await window.supabase
    .from('creator_auswahl_items')
    .select('id, name, abgelehnt, absage, nicht_umsetzen, kategorie')
    .eq('creator_auswahl_id', strategie.creator_auswahl_id)
    .order('name', { ascending: true });
  if (error) {
    console.error('Casting-Einträge konnten nicht geladen werden:', error);
    return [];
  }
  return (data || [])
    .filter((i) => i.id === vorgewaehlt
      || !(i.abgelehnt || i.absage || i.nicht_umsetzen || i.kategorie === 'Nicht umsetzen'))
    .map((i) => ({ value: i.id, label: i.name || 'Ohne Namen' }));
}

/**
 * Insert-Objekt der Videoidee aus dem Review. Reine Funktion (testbar).
 * Idee wird Kurzbeschreibung, Arbeitstitel der Titel, Hook der Hook, Ablauf der Hauptteil.
 */
export function buildKonzeptItemInsert({ strategieId, sortierung, eingabe, einreichungId }) {
  const struktur = normalisiereStruktur({
    titel: eingabe.titel,
    hook: eingabe.hook,
    hauptteil: eingabe.ablauf
  });
  const beschreibung = struktur ? strukturZuText(struktur) : '';
  return {
    ...buildStrategieItemInsert({
      strategieId,
      sortierung,
      nextItem: {
        url: null,
        platform: null,
        beschreibung: eingabe.kurzbeschreibung,
        kategorie: eingabe.kategorie,
        funnelStufe: eingabe.funnelStufe,
        personaId: eingabe.personaId,
        produktId: eingabe.produktId,
        videolaenge: eingabe.videolaenge
      }
    }),
    beschreibung_struktur: struktur,
    beschreibung,
    beschreibung_quelle: beschreibung ? 'user' : null,
    creator_auswahl_item_id: eingabe.eintragId || null,
    einreichung_id: einreichungId
  };
}

export class KonzeptEinreichungDrawer extends AddItemDrawer {
  constructor() {
    super();
    this.einreichung = null;
    this.eintragOptionen = [];
    this.onAngelegt = null;
    this.anlegenLaeuft = false;
  }

  /** @param {{ strategie: object, einreichung: object, personaOptionen: object[], eintragOptionen: object[], onAngelegt?: () => void }} p */
  async openEinreichung({ strategie, einreichung, personaOptionen, eintragOptionen, onAngelegt }) {
    this.einreichung = einreichung;
    this.eintragOptionen = eintragOptionen || [];
    this.onAngelegt = onAngelegt || null;
    await this.open(strategie, this.getTeilbereiche(strategie), personaOptionen);
  }

  getTeilbereiche(strategie) {
    return String(strategie?.teilbereich || '').split(',').map((t) => t.trim()).filter(Boolean);
  }

  createDrawer() {
    super.createDrawer();
    const absender = this.einreichung?.absender_name || '';
    const title = document.querySelector(`#${this.drawerId} .drawer-title`);
    const subtitle = document.getElementById('add-item-drawer-subtitle');
    if (title) title.textContent = 'Konzept prüfen';
    if (subtitle) {
      subtitle.textContent = `Einreichung von ${absender}. Angelegt wird eine Videoidee im Konzept.`;
    }
    const footerBtn = document.getElementById('btn-close-drawer');
    if (footerBtn) footerBtn.textContent = 'Schließen';
  }

  renderBody() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    const daten = this.einreichung?.payload?.formData || {};
    const vorgewaehlt = this.einreichung?.einladung?.creator_auswahl_item_id || '';
    const eintragWert = this.eintragOptionen.some((o) => o.value === vorgewaehlt) ? vorgewaehlt : '';
    const bloecke = konzeptSheetBloecke(daten);

    body.innerHTML = `
      <form id="add-item-form" class="add-item-drawer-form" data-no-submit-guard="true">
        ${vorgewaehlt && !eintragWert
          ? '<p class="einladung-hinweis">Der Eintrag der Einladung ist nicht mehr im Casting. Bitte unten einen Eintrag wählen oder ohne Zuordnung anlegen.</p>'
          : ''}
        <section class="add-item-section" data-add-section="inhalt">
          <h3 class="drawer-section-title">Inhalt</h3>
          <div class="add-item-section__body">
            <div class="form-field">
              <label for="konzept-titel">Titel</label>
              <input type="text" id="konzept-titel" class="form-input" maxlength="200" value="${esc(daten.arbeitstitel)}" placeholder="Arbeitstitel (optional)">
            </div>
            <div class="form-field">
              <label for="drawer-beschreibung">Kurzbeschreibung</label>
              <textarea id="drawer-beschreibung" class="form-input" rows="3" placeholder="Worum geht es in der Idee?">${esc(daten.idee)}</textarea>
            </div>
            <div class="form-field">
              <label for="konzept-hook">Hook</label>
              <textarea id="konzept-hook" class="form-input" rows="3">${esc(daten.hook)}</textarea>
            </div>
            <div class="form-field">
              <label for="konzept-ablauf">Ablauf</label>
              <textarea id="konzept-ablauf" class="form-input" rows="4">${esc(daten.ablauf)}</textarea>
            </div>
          </div>
        </section>

        <section class="add-item-section" data-add-section="einordnung">
          <h3 class="drawer-section-title">Einordnung</h3>
          <div class="add-item-section__grid">
            ${this.renderEintragField(eintragWert)}
            ${this.renderKategorieField()}
            ${this.renderFunnelField()}
            ${this.renderPersonaField()}
            ${this.renderProduktField()}
            ${this.renderDauerField()}
          </div>
        </section>

        <section class="add-item-section" data-add-section="creator-sheet">
          <h3 class="drawer-section-title">Creator-Sheet</h3>
          <p class="einladung-hinweis">So hat der Creator es geschrieben. Dieser Block ändert sich nicht und ist nur für das Team sichtbar.</p>
          <div class="add-item-section__body" data-creator-sheet>
            ${bloecke.map((b) => `
              <div class="form-field">
                <label>${b.nr ? `${esc(b.nr)} ` : ''}${esc(b.titel)}</label>
                ${b.eintraege.map((e) => `
                  <p class="field-helper">${b.eintraege.length > 1 ? `<strong>${esc(e.label)}</strong><br>` : ''}${e.link
                    ? `<a href="${esc(e.wert)}" target="_blank" rel="noopener noreferrer">${esc(e.wert)}</a>`
                    : esc(e.wert).replace(/\n/g, '<br>')}</p>`).join('')}
              </div>`).join('')}
          </div>
        </section>

        <div class="add-item-actions">
          <button type="submit" class="mdc-btn mdc-btn--create" id="btn-konzept-anlegen">
            <span class="mdc-btn__label">Als Videoidee anlegen</span>
          </button>
        </div>
      </form>`;
  }

  /** Casting-Eintrag: Pflicht ist er nicht, ohne Zuordnung wählt das Team ihn später in der Tabelle. */
  renderEintragField(wert) {
    if (!this.eintragOptionen.length && !this.strategie?.creator_auswahl_id) return '';
    return this.renderSelectField({
      label: 'Casting-Eintrag',
      field: 'add_eintrag',
      name: 'creator_auswahl_item_id',
      value: wert,
      options: this.eintragOptionen,
      placeholder: OHNE_EINTRAG
    });
  }

  bindEvents() {
    const form = document.getElementById('add-item-form');
    const closeBtn = document.getElementById('btn-close-drawer');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.anlegen();
    });
    closeBtn?.addEventListener('click', () => this.handleClose());

    // Dauer folgt der Funnel-Stufe (Paid), solange sie nicht von Hand geändert wurde.
    const dauerRoot = document.getElementById('drawer-dauer');
    bindSekundenSpanne(dauerRoot, { onCommit: () => { this.dauerDirty = true; } });
    this.abort?.abort();
    this.abort = new AbortController();
    document.addEventListener('table-select-change', (e) => {
      const { field, value, element } = e.detail || {};
      if (field !== 'add_funnel' || !element?.closest(`#${this.drawerId}`)) return;
      if (this.dauerDirty || !dauerRoot) return;
      setSekundenSpanne(dauerRoot, this.dauerVorbelegung(value), { forceInputs: true });
    }, { signal: this.abort.signal });
  }

  handleClose() {
    if (this.anlegenLaeuft) {
      window.toastSystem?.show('Videoidee wird noch angelegt – einen Moment', 'warning');
      return;
    }
    this.close();
  }

  eingabe() {
    const wert = (id) => document.getElementById(id)?.value?.trim() || '';
    return {
      titel: wert('konzept-titel'),
      kurzbeschreibung: wert('drawer-beschreibung'),
      hook: wert('konzept-hook'),
      ablauf: wert('konzept-ablauf'),
      eintragId: this.selectValue('creator_auswahl_item_id'),
      kategorie: this.selectValue('kategorie'),
      funnelStufe: this.selectValue('funnel_stufe'),
      personaId: this.selectValue('persona_id'),
      produktId: this.selectValue('produkt_id'),
      videolaenge: sekundenSpanneWert(document.getElementById('drawer-dauer'))
    };
  }

  async anlegen() {
    if (this.anlegenLaeuft) return;
    const eingabe = this.eingabe();
    if (!eingabe.kurzbeschreibung) {
      window.toastSystem?.show('Bitte eine Kurzbeschreibung angeben', 'warning');
      document.getElementById('drawer-beschreibung')?.focus();
      return;
    }
    if (eingabe.kategorie && !this.teilbereiche.includes(eingabe.kategorie)) {
      window.toastSystem?.show('Ungültige Kategorie – bitte neu auswählen', 'warning');
      return;
    }

    const knopf = document.getElementById('btn-konzept-anlegen');
    this.anlegenLaeuft = true;
    if (knopf) knopf.disabled = true;
    try {
      // Zwischenzeitlich erledigt (zweiter Mitarbeiter)? Dann nichts anlegen.
      const aktuell = await ladeEinreichung(this.einreichung.id);
      if (!aktuell || aktuell.status !== 'offen') {
        window.toastSystem?.show('Die Einreichung ist schon erledigt.', 'warning');
        this.close();
        this.onAngelegt?.();
        return;
      }

      const vorhandene = await strategieService.getStrategieItems(this.strategieId);
      const created = await strategieService.createStrategieItem(buildKonzeptItemInsert({
        strategieId: this.strategieId,
        sortierung: vorhandene.length,
        eingabe,
        einreichungId: this.einreichung.id
      }));

      const ok = await markiereKonzeptAngelegt(this.einreichung.id, created.id);
      if (!ok) window.toastSystem?.show('Die Einreichung war schon erledigt. Die Videoidee wurde trotzdem angelegt.', 'warning');

      window.dispatchEvent(new CustomEvent('strategieItemCreated', {
        detail: { strategieId: this.strategieId }
      }));
      window.toastSystem?.show('Videoidee angelegt', 'success');
      this.anlegenLaeuft = false;
      this.close();
      this.onAngelegt?.();
    } catch (error) {
      console.error('Konzept-Einreichung anlegen fehlgeschlagen:', error);
      window.toastSystem?.show('Videoidee konnte nicht angelegt werden', 'error');
    } finally {
      this.anlegenLaeuft = false;
      if (knopf?.isConnected) knopf.disabled = false;
    }
  }
}

/**
 * Einstieg aus dem Eingang: lädt Konzept, Personas und Einträge und öffnet das Review.
 * @param {{ strategieId: string, einreichung: object, onAngelegt?: () => void }} p
 */
export async function oeffneKonzeptEinreichung({ strategieId, einreichung, onAngelegt }) {
  try {
    const strategie = await strategieService.getStrategieById(strategieId, { skipAccessCheck: true });
    const personaById = await loadStrategiePersonas(window.supabase, strategie, []);
    const personaOptionen = strategiePersonaOptions(strategie?.briefing, personaById);
    const eintragOptionen = await ladeEintragOptionen(strategie, einreichung?.einladung?.creator_auswahl_item_id || null);
    await new KonzeptEinreichungDrawer().openEinreichung({
      strategie,
      einreichung,
      personaOptionen,
      eintragOptionen,
      onAngelegt
    });
  } catch (error) {
    console.error('Konzept-Review konnte nicht geöffnet werden:', error);
    window.toastSystem?.show('Das Konzept konnte nicht geladen werden.', 'error');
  }
}
