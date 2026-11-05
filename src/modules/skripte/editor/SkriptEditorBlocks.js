// SkriptEditorBlocks.js
// Skript-Dokument (ADR 0062): Freie Bloecke rund um die Skript-Tabelle
// bearbeiten. Nur das Team. Gespeichert wird die ganze Liste in
// skripte.dokument_bloecke mit Revisionszaehler: Last-Write-Wins, bei
// fremdem Zwischenstand fragt ein Dialog. Beim Neurendern der Bloecke
// wandert der DOM-Knoten der Skript-Tabelle mit, damit InlineEdit und
// offene Grid-Eingaben unberuehrt bleiben.

import { skripteService } from '../SkripteService.js';
import { openFloatingMenu } from '../../../core/components/FloatingMenu.js';
import {
  htmlToInlineMd, toggleInlineFormat, setzeLink, setzeHighlightFarbe, inlineMdText,
  domSelectionToRaw, domSelectionToRendered, renderedLength,
  selectRawRange, selectRenderedRange, teileInlineMd
} from '../../../core/utils/inlineFormat.js';
import {
  SKRIPT_TABELLE, SKRIPT_TABELLE_ID, BILD_BREITEN, TABELLE_MAX,
  normalisiereBloecke, fuerSpeichern, neuerBlock, istTextBlock, istListenBlock,
  findeBlock, indexVon, einfuegen, entfernen, verschieben, verschiebenZu, aendern,
  typWechseln, tabelleZeileEinfuegen, tabelleZeileEntfernen, tabelleSpalteEinfuegen,
  tabelleSpalteEntfernen, kopieMitNeuenIds
} from './dokument/blockModell.js';
import { dokumentHtml, renderBlockMd } from './dokument/blockRenderer.js';
import { pruefeSkriptBild, verkleinereBild, bildDateienAus } from './dokument/skriptBild.js';
import { FORMAT_AKTIONEN } from './skriptEditorKonstanten.js';

const SPEICHERN_MS = 800;
const TIPP_GRUPPE_MS = 1500;
const UNDO_MAX = 100;

export const BILD_BREITE_LABEL = { klein: 'Klein', mittel: 'Mittel', voll: 'Volle Breite' };

function zahl(wert) {
  if (wert == null || wert === '') return null;
  const n = Number(wert);
  return Number.isInteger(n) ? n : null;
}

function ersetze(bloecke, id, ersatz) {
  const i = indexVon(bloecke, id);
  if (i < 0) return bloecke;
  const liste = [...bloecke];
  liste.splice(i, 1, ...ersatz);
  return liste;
}

/** Wert einer Textzelle im Modell. */
export function wertAn(block, ort) {
  if (!block) return '';
  if (ort.feld === 'md') return block.md || '';
  if (ort.feld === 'punkte') return block.punkte?.[ort.index] ?? '';
  if (ort.feld === 'unterschrift') return block.unterschrift || '';
  if (ort.feld === 'zelle') return block.zeilen?.[ort.zeile]?.[ort.spalte] ?? '';
  return '';
}

/** Block mit neuem Wert in einer Textzelle. */
export function mitWert(block, ort, wert) {
  if (ort.feld === 'md') return { ...block, md: wert };
  if (ort.feld === 'unterschrift') return { ...block, unterschrift: wert };
  if (ort.feld === 'punkte' && ort.index != null) {
    const punkte = [...block.punkte];
    punkte[ort.index] = wert;
    return { ...block, punkte };
  }
  if (ort.feld === 'zelle' && ort.zeile != null && ort.spalte != null) {
    const zeilen = block.zeilen.map((z) => [...z]);
    if (zeilen[ort.zeile]) zeilen[ort.zeile][ort.spalte] = wert;
    return { ...block, zeilen };
  }
  return block;
}

function ersteZelleOrt(block) {
  if (!block) return null;
  if (istTextBlock(block)) return { blockId: block.id, feld: 'md', offset: 0 };
  if (istListenBlock(block)) return { blockId: block.id, feld: 'punkte', index: 0, offset: 0 };
  if (block.typ === 'tabelle') return { blockId: block.id, feld: 'zelle', zeile: 0, spalte: 0, offset: 0 };
  return { blockId: block.id };
}

function letzteZelleOrt(block) {
  if (!block) return null;
  if (istTextBlock(block)) return { blockId: block.id, feld: 'md', offset: 'ende' };
  if (istListenBlock(block)) return { blockId: block.id, feld: 'punkte', index: block.punkte.length - 1, offset: 'ende' };
  if (block.typ === 'tabelle') {
    const zeile = block.zeilen.length - 1;
    return { blockId: block.id, feld: 'zelle', zeile, spalte: block.zeilen[zeile].length - 1, offset: 'ende' };
  }
  return { blockId: block.id };
}

export class SkriptEditorBlocks {
  constructor(view) {
    this.view = view;
    this.root = null;
    this.skriptId = null;
    this.bloecke = normalisiereBloecke(null);
    this.rev = 0;
    this.dirty = false;
    this.timer = null;
    this.laeuft = null;
    this.nochmal = false;
    this.nochmalUeberschreiben = false;
    this.konfliktOffen = false;
    this.undoStack = [];
    this.redoStack = [];
    this.tippGruppe = { key: null, zeit: 0 };
    this.aktiverBlockId = null;
    this.letzteTabellenZelle = null;
    this.dragId = null;
    this.uploads = 0;
  }

  // ------------------------------------------------------------------
  // Stand und Speichern
  // ------------------------------------------------------------------

  /** Vor jedem renderDoc: Stand aus dem Skript, ungespeicherte eigene Aenderungen gewinnen. */
  sync(skript) {
    if (!skript?.id) return;
    if (skript.id !== this.skriptId) {
      this.laden(skript);
      return;
    }
    if (skript.dokument_bloecke === this.bloecke) return;
    if (this.dirty || this.laeuft) {
      skript.dokument_bloecke = this.bloecke;
      skript.dokument_bloecke_rev = this.rev;
      return;
    }
    this.laden(skript, { undoBehalten: true });
  }

  laden(skript, { undoBehalten = false } = {}) {
    clearTimeout(this.timer);
    this.timer = null;
    this.skriptId = skript.id;
    this.bloecke = normalisiereBloecke(skript.dokument_bloecke);
    this.rev = Number(skript.dokument_bloecke_rev) || 0;
    skript.dokument_bloecke = this.bloecke;
    this.dirty = false;
    if (!undoBehalten) {
      this.undoStack = [];
      this.redoStack = [];
      this.aktiverBlockId = null;
      this.letzteTabellenZelle = null;
    }
    this.tippGruppe = { key: null, zeit: 0 };
  }

  geaendert() {
    const v = this.view;
    if (v.skript?.id === this.skriptId) v.skript.dokument_bloecke = this.bloecke;
    this.dirty = true;
    v._toolbar?.aktualisieren();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.speichern();
    }, SPEICHERN_MS);
  }

  async speichern({ ueberschreiben = false } = {}) {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.laeuft) {
      this.nochmal = true;
      if (ueberschreiben) this.nochmalUeberschreiben = true;
      return this.laeuft;
    }
    if (!this.dirty || !this.skriptId || this.konfliktOffen) return;
    this.dirty = false;
    const skriptId = this.skriptId;
    const stand = fuerSpeichern(this.bloecke);
    this.laeuft = (async () => {
      try {
        let rev = this.rev;
        if (ueberschreiben) rev = (await skripteService.loadDokumentBloecke(skriptId)).rev;
        const res = await skripteService.saveDokumentBloecke(skriptId, stand, rev);
        if (skriptId !== this.skriptId) return;
        if (res.konflikt) {
          this.dirty = true;
          this.nochmal = false;
          this.konflikt();
          return;
        }
        this.rev = res.rev;
        if (this.view.skript?.id === skriptId) this.view.skript.dokument_bloecke_rev = res.rev;
      } catch (err) {
        if (skriptId === this.skriptId) this.dirty = true;
        window.toastSystem?.error(`Dokument nicht gespeichert: ${err.message}`);
      }
    })();
    try {
      await this.laeuft;
    } finally {
      this.laeuft = null;
      if (this.nochmal) {
        const mitUeberschreiben = this.nochmalUeberschreiben;
        this.nochmal = false;
        this.nochmalUeberschreiben = false;
        if (this.dirty) this.speichern({ ueberschreiben: mitUeberschreiben });
      }
      this.view._toolbar?.aktualisieren();
    }
  }

  /** Vor Skript-Wechsel und Abbau. */
  async flush() {
    clearTimeout(this.timer);
    this.timer = null;
    for (let i = 0; i < 3 && (this.laeuft || (this.dirty && !this.konfliktOffen)); i++) {
      if (this.laeuft) await this.laeuft.catch(() => {});
      else await this.speichern();
    }
  }

  async konflikt() {
    if (this.konfliktOffen) return;
    this.konfliktOffen = true;
    let ueberschreiben = false;
    try {
      const res = await window.confirmationModal?.open({
        title: 'Dokument wurde parallel geändert',
        message: 'Jemand anderes hat die Blöcke rund um die Skript-Tabelle gespeichert, während du sie bearbeitet hast. '
          + 'Speicherst du deinen Stand, ist der andere weg. Lädst du den anderen Stand, holt ⌘Z deinen zurück.',
        confirmText: 'Meinen Stand speichern',
        cancelText: 'Anderen Stand laden'
      });
      ueberschreiben = Boolean(res?.confirmed);
    } finally {
      this.konfliktOffen = false;
    }
    if (ueberschreiben) {
      this.dirty = true;
      await this.speichern({ ueberschreiben: true });
      return;
    }
    await this.neuLaden();
  }

  async neuLaden() {
    const skriptId = this.skriptId;
    try {
      const { bloecke, rev } = await skripteService.loadDokumentBloecke(skriptId);
      if (skriptId !== this.skriptId) return;
      this.merkeStand();
      this.bloecke = normalisiereBloecke(bloecke);
      this.rev = rev;
      this.dirty = false;
      if (this.view.skript?.id === skriptId) {
        this.view.skript.dokument_bloecke = this.bloecke;
        this.view.skript.dokument_bloecke_rev = rev;
      }
      this.renderBloecke();
    } catch (err) {
      window.toastSystem?.error(err.message);
    }
  }

  // ------------------------------------------------------------------
  // Undo / Redo (nur Bloecke; die Skript-Tabelle hat eigene Versionen)
  // ------------------------------------------------------------------

  merkeStand() {
    const stand = JSON.stringify(this.bloecke);
    if (this.undoStack.at(-1) !== stand) {
      this.undoStack.push(stand);
      if (this.undoStack.length > UNDO_MAX) this.undoStack.shift();
    }
    this.redoStack = [];
  }

  get kannRueckgaengig() {
    const jetzt = JSON.stringify(this.bloecke);
    return this.undoStack.some((s) => s !== jetzt);
  }

  get kannWiederholen() {
    return this.redoStack.length > 0;
  }

  rueckgaengig() {
    const jetzt = JSON.stringify(this.bloecke);
    while (this.undoStack.length && this.undoStack.at(-1) === jetzt) this.undoStack.pop();
    const vorher = this.undoStack.pop();
    if (!vorher) return false;
    this.redoStack.push(jetzt);
    this.anwendenStand(vorher);
    return true;
  }

  wiederholen() {
    const nachher = this.redoStack.pop();
    if (!nachher) return false;
    this.undoStack.push(JSON.stringify(this.bloecke));
    this.anwendenStand(nachher);
    return true;
  }

  anwendenStand(json) {
    const fokus = this.aktuellerFokus();
    this.bloecke = normalisiereBloecke(JSON.parse(json));
    this.tippGruppe = { key: null, zeit: 0 };
    this.geaendert();
    this.renderBloecke({ fokus });
  }

  /** Strukturaenderung: Undo-Punkt, neue Liste, neu rendern, Fokus setzen. */
  struktur(fn, fokus = null) {
    this.merkeStand();
    this.bloecke = normalisiereBloecke(fn(this.bloecke));
    this.tippGruppe = { key: null, zeit: 0 };
    this.geaendert();
    this.renderBloecke({ fokus });
  }

  // ------------------------------------------------------------------
  // DOM
  // ------------------------------------------------------------------

  attach(docEl) {
    this.root = docEl?.querySelector('#ed-dokument') || null;
    if (!this.root || !this.view.kannBloeckeEditieren) return;
    const r = this.root;
    r.addEventListener('input', (e) => this.onInput(e));
    r.addEventListener('keydown', (e) => this.onKeyDown(e));
    r.addEventListener('paste', (e) => this.onPaste(e));
    r.addEventListener('focusin', (e) => this.onFocusIn(e));
    r.addEventListener('click', (e) => this.onClick(e));
    r.addEventListener('dragstart', (e) => this.onDragStart(e));
    r.addEventListener('dragover', (e) => this.onDragOver(e));
    r.addEventListener('dragleave', (e) => this.onDragLeave(e));
    r.addEventListener('drop', (e) => this.onDrop(e));
    r.addEventListener('dragend', () => this.dragEnde());
    this.markiereAktiv();
  }

  renderBloecke({ fokus = null } = {}) {
    if (!this.root?.isConnected) return;
    const slotSelektor = `[data-block-id="${SKRIPT_TABELLE_ID}"] > .skripte-editor-block-inhalt`;
    const altSlot = this.root.querySelector(slotSelektor);
    const tmp = document.createElement('div');
    tmp.innerHTML = dokumentHtml(this.bloecke, {
      editierbar: true,
      mitIntern: true,
      bildUrl: (pfad) => skripteService.skriptBildUrl(pfad),
      skriptTabelleHtml: ''
    });
    const neu = tmp.firstElementChild;
    const slot = neu.querySelector(slotSelektor);
    if (slot && altSlot) slot.replaceChildren(...altSlot.childNodes);
    this.root.replaceChildren(...neu.childNodes);
    this.markiereAktiv();
    if (fokus) this.fokussiere(fokus);
    this.view._toolbar?.aktualisieren();
  }

  blockZelle(node) {
    const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const zelle = el?.closest?.('.skripte-editor-block-text');
    return zelle && this.root?.contains(zelle) && zelle.isContentEditable !== false ? zelle : null;
  }

  blockEl(id) {
    if (!this.root || !id) return null;
    return [...this.root.querySelectorAll('[data-block-id]')].find((el) => el.dataset.blockId === id) || null;
  }

  ortVon(zelle) {
    const blockEl = zelle.closest('[data-block-id]');
    return {
      blockId: blockEl?.dataset.blockId || null,
      feld: zelle.dataset.blockFeld,
      index: zahl(zelle.dataset.index),
      zeile: zahl(zelle.dataset.zeile),
      spalte: zahl(zelle.dataset.spalte)
    };
  }

  zelleFuerOrt(ort) {
    const blockEl = this.blockEl(ort?.blockId);
    if (!blockEl) return null;
    const zellen = [...blockEl.querySelectorAll('.skripte-editor-block-text')];
    if (!ort.feld) return zellen[0] || null;
    return zellen.find((z) => z.dataset.blockFeld === ort.feld
      && (ort.index == null || zahl(z.dataset.index) === ort.index)
      && (ort.zeile == null || zahl(z.dataset.zeile) === ort.zeile)
      && (ort.spalte == null || zahl(z.dataset.spalte) === ort.spalte)) || null;
  }

  aktuellerFokus() {
    const zelle = this.blockZelle(document.activeElement);
    if (!zelle) return this.aktiverBlockId ? { blockId: this.aktiverBlockId } : null;
    const pos = domSelectionToRendered(zelle);
    return { ...this.ortVon(zelle), offset: pos?.start ?? 'ende' };
  }

  fokussiere(fokus) {
    if (!fokus?.blockId) return;
    this.setAktiv(fokus.blockId);
    const blockEl = this.blockEl(fokus.blockId);
    if (!fokus.feld) {
      if (blockEl?.hasAttribute('tabindex')) blockEl.focus({ preventScroll: true });
      blockEl?.scrollIntoView?.({ block: 'nearest' });
      return;
    }
    const zelle = this.zelleFuerOrt(fokus);
    if (zelle) this.fokussiereZelle(zelle, fokus.offset);
  }

  fokussiereZelle(zelle, offset = 0) {
    zelle.focus({ preventScroll: true });
    const len = renderedLength(zelle);
    const pos = offset === 'ende' || offset == null ? len : Math.min(Math.max(0, offset), len);
    try { selectRenderedRange(zelle, pos); } catch (_) { /* leere Zelle */ }
    zelle.scrollIntoView?.({ block: 'nearest' });
  }

  setAktiv(id) {
    if (this.aktiverBlockId === id) return;
    this.aktiverBlockId = id;
    this.markiereAktiv();
    this.view._toolbar?.aktualisieren();
  }

  markiereAktiv() {
    if (!this.root) return;
    this.root.querySelectorAll('.skripte-editor-block.is-aktiv').forEach((el) => el.classList.remove('is-aktiv'));
    this.blockEl(this.aktiverBlockId)?.classList.add('is-aktiv');
  }

  aktiverBlock() {
    return findeBlock(this.bloecke, this.aktiverBlockId);
  }

  // ------------------------------------------------------------------
  // Events
  // ------------------------------------------------------------------

  onInput(e) {
    const zelle = this.blockZelle(e.target);
    if (!zelle) return;
    const ort = this.ortVon(zelle);
    const block = findeBlock(this.bloecke, ort.blockId);
    if (!block) return;
    const key = [ort.blockId, ort.feld, ort.index, ort.zeile, ort.spalte].join(':');
    const jetzt = Date.now();
    if (key !== this.tippGruppe.key || jetzt - this.tippGruppe.zeit > TIPP_GRUPPE_MS) this.merkeStand();
    this.tippGruppe = { key, zeit: jetzt };
    const wert = htmlToInlineMd(zelle);
    // Leere Zelle wirklich leeren, sonst bleibt ein <br> und der Platzhalter fehlt
    if (!wert && zelle.innerHTML) zelle.innerHTML = '';
    this.bloecke = this.bloecke.map((b) => (b.id === block.id ? mitWert(b, ort, wert) : b));
    this.geaendert();
  }

  onFocusIn(e) {
    const blockEl = e.target.closest?.('[data-block-id]');
    if (blockEl) this.setAktiv(blockEl.dataset.blockId);
    const zelle = this.blockZelle(e.target);
    if (zelle?.dataset.blockFeld === 'zelle') {
      const ort = this.ortVon(zelle);
      this.letzteTabellenZelle = { blockId: ort.blockId, zeile: ort.zeile, spalte: ort.spalte };
    }
  }

  onClick(e) {
    const griff = e.target.closest?.('[data-block-griff]');
    if (griff) {
      e.preventDefault();
      this.oeffneGriffMenue(griff);
      return;
    }
    if (e.target.closest?.('[data-dokument-ende]')) {
      this.schreibenAm('ende');
      return;
    }
    if (e.target.closest?.('[data-dokument-anfang]')) {
      this.schreibenAm('anfang');
      return;
    }
    const link = e.target.closest?.('.skripte-editor-block-text a[href]');
    if (link && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      window.open(link.href, '_blank', 'noopener');
      return;
    }
    const blockEl = e.target.closest?.('[data-block-id]');
    if (!blockEl) return;
    this.setAktiv(blockEl.dataset.blockId);
    if (blockEl.hasAttribute('tabindex') && !this.blockZelle(e.target)) blockEl.focus({ preventScroll: true });
  }

  onKeyDown(e) {
    if (e.key === 'Escape') {
      this.view._toolbar?.schliessen();
      const menu = document.getElementById('ed-blockmenu');
      if (menu) menu.hidden = true;
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    const zelle = this.blockZelle(e.target);

    // Fokus auf Bild/Trennlinie selbst (nicht in einer Zelle)
    if (!zelle && !mod) {
      const blockEl = e.target.closest?.('[data-block-id][tabindex]');
      if (blockEl && blockEl === e.target && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        this.loeschen(blockEl.dataset.blockId);
      }
      return;
    }
    if (!zelle) return;

    const taste = e.key.toLowerCase();
    if (mod && !e.altKey) {
      if (taste === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.wiederholen();
        else this.rueckgaengig();
        return;
      }
      if (taste === 'y' && !e.shiftKey) {
        e.preventDefault();
        this.wiederholen();
        return;
      }
      if (!e.shiftKey && (taste === 'b' || taste === 'i')) {
        e.preventDefault();
        this.formatiereLive(taste === 'b' ? 'bold' : 'italic');
        return;
      }
      if (e.shiftKey && taste === 'h') {
        e.preventDefault();
        this.formatiereLive('highlight');
        return;
      }
      if (!e.shiftKey && taste === 'k') {
        e.preventDefault();
        this.view._toolbar?.oeffneLink();
      }
      return;
    }
    if (e.isComposing) return;

    const ort = this.ortVon(zelle);
    const block = findeBlock(this.bloecke, ort.blockId);
    if (!block) return;
    if (e.key === 'Enter' && !e.shiftKey) this.onEnter(e, zelle, ort, block);
    else if (e.key === 'Backspace') this.onBackspace(e, zelle, ort, block);
    else if (e.key === 'Tab' && ort.feld === 'zelle') this.onTabInTabelle(e, ort, block);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') this.onPfeil(e, zelle, ort);
  }

  onEnter(e, zelle, ort, block) {
    if (ort.feld === 'zelle') return;
    e.preventDefault();
    if (ort.feld === 'unterschrift') {
      this.absatzNach(block.id);
      return;
    }
    const raw = htmlToInlineMd(zelle);
    const len = renderedLength(zelle);
    const pos = domSelectionToRendered(zelle) || { start: len, end: len };
    const [links] = teileInlineMd(raw, pos.start);
    const [, rechts] = teileInlineMd(raw, pos.end);

    if (ort.feld === 'md') {
      if (pos.start === 0 && pos.end === 0 && raw) {
        // Caret ganz vorne: leerer Absatz davor, der Block bleibt wie er ist
        const davor = neuerBlock('absatz', { intern: block.intern });
        this.struktur((b) => einfuegen(b, davor, { vorId: block.id }), { blockId: block.id, feld: 'md', offset: 0 });
        return;
      }
      const neu = neuerBlock('absatz', { md: rechts, intern: block.intern });
      this.struktur(
        (b) => einfuegen(aendern(b, block.id, { md: links }), neu, { nachId: block.id }),
        { blockId: neu.id, feld: 'md', offset: 0 }
      );
      return;
    }

    // Listenpunkt
    const i = ort.index;
    const vor = block.punkte.slice(0, i);
    const nach = block.punkte.slice(i + 1);
    if (!raw.trim()) {
      // Leerer Punkt: Liste an dieser Stelle verlassen
      const absatz = neuerBlock('absatz', { intern: block.intern });
      const ersatz = [];
      if (vor.length) ersatz.push({ ...block, punkte: vor });
      ersatz.push(absatz);
      if (nach.length) ersatz.push(neuerBlock(block.typ, { punkte: nach, intern: block.intern }));
      this.struktur((b) => ersetze(b, block.id, ersatz), { blockId: absatz.id, feld: 'md', offset: 0 });
      return;
    }
    const punkte = [...vor, links, rechts, ...nach];
    this.struktur(
      (b) => aendern(b, block.id, { punkte }),
      { blockId: block.id, feld: 'punkte', index: i + 1, offset: 0 }
    );
  }

  onBackspace(e, zelle, ort, block) {
    if (ort.feld !== 'md' && ort.feld !== 'punkte') return;
    const pos = domSelectionToRendered(zelle);
    if (!pos || pos.start !== 0 || pos.end !== 0) return;
    const raw = htmlToInlineMd(zelle);

    if (ort.feld === 'punkte') {
      e.preventDefault();
      const i = ort.index;
      if (i > 0) {
        const punkte = [...block.punkte];
        const vorher = punkte[i - 1];
        punkte.splice(i - 1, 2, vorher + raw);
        this.struktur(
          (b) => aendern(b, block.id, { punkte }),
          { blockId: block.id, feld: 'punkte', index: i - 1, offset: inlineMdText(vorher).length }
        );
        return;
      }
      // Erster Punkt: Aufzaehlung weg, der Text wird Absatz davor
      const absatz = neuerBlock('absatz', { md: raw, intern: block.intern });
      const rest = block.punkte.slice(1);
      const ersatz = rest.length ? [absatz, { ...block, punkte: rest }] : [absatz];
      this.struktur((b) => ersetze(b, block.id, ersatz), { blockId: absatz.id, feld: 'md', offset: 0 });
      return;
    }

    if (block.typ !== 'absatz') {
      // Ueberschrift am Anfang: erst zum Absatz machen
      e.preventDefault();
      this.struktur(
        (b) => b.map((x) => (x.id === block.id ? typWechseln(x, 'absatz') : x)),
        { blockId: block.id, feld: 'md', offset: 0 }
      );
      return;
    }

    const vorher = this.bloecke[indexVon(this.bloecke, block.id) - 1];
    if (!vorher) return;
    e.preventDefault();
    if (vorher.typ === 'trennlinie') {
      this.struktur((b) => entfernen(b, vorher.id), { blockId: block.id, feld: 'md', offset: 0 });
      return;
    }
    if (istTextBlock(vorher)) {
      this.struktur(
        (b) => entfernen(aendern(b, vorher.id, { md: vorher.md + raw }), block.id),
        { blockId: vorher.id, feld: 'md', offset: inlineMdText(vorher.md).length }
      );
      return;
    }
    if (istListenBlock(vorher)) {
      const punkte = [...vorher.punkte];
      const letzter = punkte.length - 1;
      const offset = inlineMdText(punkte[letzter]).length;
      punkte[letzter] += raw;
      this.struktur(
        (b) => entfernen(aendern(b, vorher.id, { punkte }), block.id),
        { blockId: vorher.id, feld: 'punkte', index: letzter, offset }
      );
      return;
    }
    // Bild, Tabelle oder Skript-Tabelle davor: nur ein leerer Absatz verschwindet
    if (!raw) this.struktur((b) => entfernen(b, block.id), letzteZelleOrt(vorher));
  }

  onTabInTabelle(e, ort, block) {
    e.preventDefault();
    const spalten = block.zeilen[0]?.length || 1;
    const idx = ort.zeile * spalten + ort.spalte + (e.shiftKey ? -1 : 1);
    if (idx < 0) return;
    if (idx >= block.zeilen.length * spalten) {
      if (block.zeilen.length >= TABELLE_MAX) return;
      const neueZeile = block.zeilen.length;
      this.struktur(
        (b) => b.map((x) => (x.id === block.id ? tabelleZeileEinfuegen(x, x.zeilen.length - 1) : x)),
        { blockId: block.id, feld: 'zelle', zeile: neueZeile, spalte: 0, offset: 0 }
      );
      return;
    }
    this.fokussiere({
      blockId: block.id, feld: 'zelle', zeile: Math.floor(idx / spalten), spalte: idx % spalten, offset: 'ende'
    });
  }

  onPfeil(e, zelle, ort) {
    if (ort.feld === 'zelle' || e.shiftKey || e.altKey) return;
    const pos = domSelectionToRendered(zelle);
    if (!pos || pos.start !== pos.end) return;
    const hoch = e.key === 'ArrowUp';
    if (hoch && pos.start !== 0) return;
    if (!hoch && pos.end !== renderedLength(zelle)) return;
    const zellen = [...this.root.querySelectorAll('.skripte-editor-block-text')];
    const ziel = zellen[zellen.indexOf(zelle) + (hoch ? -1 : 1)];
    if (!ziel) return;
    e.preventDefault();
    this.fokussiereZelle(ziel, hoch ? 'ende' : 0);
  }

  onPaste(e) {
    const dateien = bildDateienAus(e.clipboardData);
    if (dateien.length) {
      e.preventDefault();
      const blockEl = e.target.closest?.('[data-block-id]');
      this.bilderEinfuegen(dateien, blockEl ? { nachId: blockEl.dataset.blockId } : null);
      return;
    }
    const zelle = this.blockZelle(e.target);
    if (!zelle || e.defaultPrevented) return;
    e.preventDefault();
    const text = (e.clipboardData?.getData('text/plain') ?? '').replace(/\r\n?/g, '\n');
    if (!text) return;
    const ort = this.ortVon(zelle);
    const block = findeBlock(this.bloecke, ort.blockId);
    const zeilen = text.split('\n');
    if (block && zeilen.length > 1 && (ort.feld === 'md' || ort.feld === 'punkte')) {
      this.mehrzeiligEinfuegen(zelle, ort, block, zeilen);
      return;
    }
    this.textEinfuegen(zelle, ort.feld === 'unterschrift' ? text.replace(/\n+/g, ' ') : text);
  }

  textEinfuegen(zelle, text) {
    const sel = window.getSelection();
    const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    if (range && zelle.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      zelle.append(document.createTextNode(text));
    }
    zelle.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /** Mehrere Zeilen: Absatz wird zu mehreren Absaetzen, Liste zu mehreren Punkten. */
  mehrzeiligEinfuegen(zelle, ort, block, zeilen) {
    const raw = htmlToInlineMd(zelle);
    const len = renderedLength(zelle);
    const pos = domSelectionToRendered(zelle) || { start: len, end: len };
    const [links] = teileInlineMd(raw, pos.start);
    const [, rechts] = teileInlineMd(raw, pos.end);
    const letzte = zeilen.at(-1);
    const offset = inlineMdText(letzte).length;
    const texte = [links + zeilen[0], ...zeilen.slice(1, -1), letzte + rechts];

    if (ort.feld === 'punkte') {
      const punkte = [...block.punkte];
      punkte.splice(ort.index, 1, ...texte);
      this.struktur(
        (b) => aendern(b, block.id, { punkte }),
        { blockId: block.id, feld: 'punkte', index: ort.index + texte.length - 1, offset }
      );
      return;
    }
    const neue = texte.slice(1).map((md) => neuerBlock('absatz', { md, intern: block.intern }));
    const letzterId = neue.at(-1).id;
    this.struktur(
      (b) => einfuegen(aendern(b, block.id, { md: texte[0] }), neue, { nachId: block.id }),
      { blockId: letzterId, feld: 'md', offset }
    );
  }

  // ------------------------------------------------------------------
  // Drag and drop (Bloecke verschieben, Bilder ablegen)
  // ------------------------------------------------------------------

  onDragStart(e) {
    const griff = e.target.closest?.('[data-block-griff]');
    if (!griff) return;
    const blockEl = griff.closest('[data-block-id]');
    if (!blockEl) return;
    this.dragId = blockEl.dataset.blockId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
      e.dataTransfer.setDragImage?.(blockEl, 16, 16);
    }
    document.getElementById('ed-blockmenu')?.setAttribute('hidden', '');
    blockEl.classList.add('is-dragging');
  }

  dropZiel(e) {
    let blockEl = e.target.closest?.('[data-block-id]');
    if (!blockEl || !this.root.contains(blockEl)) {
      blockEl = [...this.root.children].filter((el) => el.dataset?.blockId).at(-1) || null;
      return blockEl ? { el: blockEl, id: blockEl.dataset.blockId, position: 'nach' } : null;
    }
    const rect = blockEl.getBoundingClientRect();
    return {
      el: blockEl,
      id: blockEl.dataset.blockId,
      position: e.clientY < rect.top + rect.height / 2 ? 'vor' : 'nach'
    };
  }

  zeigeDropMarke(ziel) {
    this.root?.querySelectorAll('.is-drop-vor, .is-drop-nach')
      .forEach((el) => el.classList.remove('is-drop-vor', 'is-drop-nach'));
    if (ziel && ziel.id !== this.dragId) ziel.el.classList.add(ziel.position === 'vor' ? 'is-drop-vor' : 'is-drop-nach');
  }

  onDragOver(e) {
    const mitDateien = [...(e.dataTransfer?.types || [])].includes('Files');
    if (!this.dragId && !mitDateien) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = this.dragId ? 'move' : 'copy';
    this.zeigeDropMarke(this.dropZiel(e));
  }

  onDragLeave(e) {
    if (!e.relatedTarget || !this.root.contains(e.relatedTarget)) this.zeigeDropMarke(null);
  }

  onDrop(e) {
    const ziel = this.dropZiel(e);
    if (this.dragId) {
      e.preventDefault();
      const id = this.dragId;
      this.dragEnde();
      if (ziel && ziel.id !== id) this.struktur((b) => verschiebenZu(b, id, ziel.id, ziel.position), { blockId: id });
      return;
    }
    const dateien = bildDateienAus(e.dataTransfer);
    if (!dateien.length) return;
    e.preventDefault();
    this.zeigeDropMarke(null);
    const position = ziel ? { [ziel.position === 'vor' ? 'vorId' : 'nachId']: ziel.id } : null;
    this.bilderEinfuegen(dateien, position);
  }

  dragEnde() {
    this.dragId = null;
    this.root?.querySelectorAll('.is-dragging').forEach((el) => el.classList.remove('is-dragging'));
    this.zeigeDropMarke(null);
  }

  // ------------------------------------------------------------------
  // Aktionen (Toolbar, Griff-Menue, Selektions-Menue)
  // ------------------------------------------------------------------

  einfuegeZiel() {
    return this.aktiverBlock() ? { nachId: this.aktiverBlockId } : {};
  }

  /**
   * Neue Bloecke hinter den aktiven Block. Ein leerer aktiver Absatz wird
   * ersetzt; steht danach nichts mehr, folgt ein leerer Absatz zum Weiterschreiben.
   */
  einfuegenBloecke(neue, { ziel = null, fokus = null } = {}) {
    const liste = (Array.isArray(neue) ? neue : [neue]).filter(Boolean);
    if (!liste.length) return;
    const zielOpt = ziel || this.einfuegeZiel();
    const bezug = findeBlock(this.bloecke, zielOpt.nachId || zielOpt.vorId);
    const ersetzen = bezug?.typ === 'absatz' && !bezug.md.trim();
    const letzter = liste.at(-1);
    const absatzDanach = !istTextBlock(letzter) && !istListenBlock(letzter);
    this.struktur((b) => {
      let out = einfuegen(b, liste, zielOpt);
      if (ersetzen) out = entfernen(out, bezug.id);
      if (absatzDanach && indexVon(out, letzter.id) === out.length - 1) {
        out = einfuegen(out, neuerBlock('absatz'), { nachId: letzter.id });
      }
      return out;
    }, fokus || ersteZelleOrt(liste[0]));
  }

  absatzNach(id) {
    const neu = neuerBlock('absatz');
    this.struktur((b) => einfuegen(b, neu, { nachId: id }), { blockId: neu.id, feld: 'md', offset: 0 });
  }

  schreibenAm(wo) {
    const rand = wo === 'anfang' ? this.bloecke[0] : this.bloecke.at(-1);
    if (rand?.typ === 'absatz' && !rand.md) {
      this.fokussiere({ blockId: rand.id, feld: 'md', offset: 0 });
      return;
    }
    const neu = neuerBlock('absatz');
    const ziel = wo === 'anfang' && rand ? { vorId: rand.id } : {};
    this.struktur((b) => einfuegen(b, neu, ziel), { blockId: neu.id, feld: 'md', offset: 0 });
  }

  /** Absatz, Ueberschrift oder Liste fuer den aktiven Block (oder neu einfuegen). */
  typSetzen(typ) {
    const block = this.aktiverBlock();
    if (block && (istTextBlock(block) || istListenBlock(block))) {
      const ziel = block.typ === typ && istListenBlock(block) ? 'absatz' : typ;
      if (ziel === block.typ) return;
      const neu = typWechseln(block, ziel);
      this.struktur((b) => b.map((x) => (x.id === block.id ? neu : x)), letzteZelleOrt(neu));
      return;
    }
    this.einfuegenBloecke(neuerBlock(typ));
  }

  setzeIntern(id, intern) {
    const block = findeBlock(this.bloecke, id);
    if (!block || block.typ === SKRIPT_TABELLE) return;
    this.struktur((b) => aendern(b, id, { intern }), this.aktuellerFokus() || { blockId: id });
  }

  setzeBildBreite(id, breite) {
    const block = findeBlock(this.bloecke, id);
    if (block?.typ !== 'bild' || !BILD_BREITEN.includes(breite) || block.breite === breite) return;
    this.struktur((b) => aendern(b, id, { breite }), { blockId: id });
  }

  tabelleAendern(id, fn) {
    const block = findeBlock(this.bloecke, id);
    if (block?.typ !== 'tabelle') return;
    const tz = this.letzteTabellenZelle?.blockId === id ? this.letzteTabellenZelle : null;
    const neu = fn(block, tz);
    if (neu === block) return;
    this.letzteTabellenZelle = null;
    this.struktur((b) => b.map((x) => (x.id === id ? neu : x)), { blockId: id });
  }

  loeschen(id) {
    const block = findeBlock(this.bloecke, id);
    if (!block || block.typ === SKRIPT_TABELLE) return;
    const i = indexVon(this.bloecke, id);
    const nachbar = this.bloecke[i - 1] || this.bloecke[i + 1];
    this.struktur((b) => entfernen(b, id), nachbar && nachbar.typ !== SKRIPT_TABELLE ? letzteZelleOrt(nachbar) : null);
    window.toastSystem?.info('Block gelöscht. ⌘Z macht es rückgängig.');
  }

  oeffneGriffMenue(griff) {
    const blockEl = griff.closest('[data-block-id]');
    const block = findeBlock(this.bloecke, blockEl?.dataset.blockId);
    const menu = document.getElementById('ed-blockmenu');
    if (!block || !menu) return;
    this.setAktiv(block.id);
    const i = indexVon(this.bloecke, block.id);
    const items = [];
    if (i > 0) items.push({ id: 'hoch', icon: 'chevron-up', label: 'Nach oben' });
    if (i < this.bloecke.length - 1) items.push({ id: 'runter', icon: 'chevron-down', label: 'Nach unten' });
    items.push(
      { id: 'absatz_davor', icon: 'plus', label: 'Text darüber' },
      { id: 'absatz_danach', icon: 'plus', label: 'Text darunter' }
    );
    if (block.typ === 'tabelle') {
      items.push({
        id: 'tabelle',
        icon: 'table-cells',
        label: 'Tabelle',
        children: [
          { id: 'zeile_dazu', label: 'Zeile darunter einfügen' },
          { id: 'spalte_dazu', label: 'Spalte rechts einfügen' },
          { id: 'zeile_weg', label: 'Zeile löschen' },
          { id: 'spalte_weg', label: 'Spalte löschen' },
          { id: 'kopfzeile', label: 'Kopfzeile', active: block.kopfzeile }
        ]
      });
    }
    if (block.typ === 'bild') {
      items.push({
        id: 'breite',
        icon: 'photo',
        label: 'Breite',
        children: BILD_BREITEN.map((b) => ({ id: `breite_${b}`, label: BILD_BREITE_LABEL[b], active: block.breite === b }))
      });
    }
    if (block.typ !== SKRIPT_TABELLE) {
      items.push(
        {
          id: 'intern',
          icon: block.intern ? 'lock-open' : 'lock-closed',
          label: block.intern ? 'Für alle sichtbar machen' : 'Nur intern (nicht für Kunde/Creator)'
        },
        { id: 'duplizieren', icon: 'document-duplicate', label: 'Duplizieren' },
        { id: 'loeschen', icon: 'trash', label: 'Löschen' }
      );
    }
    openFloatingMenu({
      el: menu,
      anchor: griff,
      wrap: this.view.container?.querySelector('.skripte-editor'),
      layout: 'icon-label',
      items,
      onSelect: (aktion) => this.griffAktion(block.id, aktion)
    });
  }

  griffAktion(id, aktion) {
    const block = findeBlock(this.bloecke, id);
    if (!block) return;
    if (aktion.startsWith('breite_')) {
      this.setzeBildBreite(id, aktion.slice('breite_'.length));
      return;
    }
    switch (aktion) {
      case 'hoch':
        this.struktur((b) => verschieben(b, id, -1), { blockId: id });
        return;
      case 'runter':
        this.struktur((b) => verschieben(b, id, 1), { blockId: id });
        return;
      case 'absatz_davor': {
        const neu = neuerBlock('absatz');
        this.struktur((b) => einfuegen(b, neu, { vorId: id }), { blockId: neu.id, feld: 'md', offset: 0 });
        return;
      }
      case 'absatz_danach':
        this.absatzNach(id);
        return;
      case 'zeile_dazu':
        this.tabelleAendern(id, (t, tz) => tabelleZeileEinfuegen(t, tz ? tz.zeile : t.zeilen.length - 1));
        return;
      case 'zeile_weg':
        this.tabelleAendern(id, (t, tz) => tabelleZeileEntfernen(t, tz ? tz.zeile : t.zeilen.length - 1));
        return;
      case 'spalte_dazu':
        this.tabelleAendern(id, (t, tz) => tabelleSpalteEinfuegen(t, tz ? tz.spalte : t.zeilen[0].length - 1));
        return;
      case 'spalte_weg':
        this.tabelleAendern(id, (t, tz) => tabelleSpalteEntfernen(t, tz ? tz.spalte : t.zeilen[0].length - 1));
        return;
      case 'kopfzeile':
        this.tabelleAendern(id, (t) => ({ ...t, kopfzeile: !t.kopfzeile }));
        return;
      case 'intern':
        this.setzeIntern(id, !block.intern);
        return;
      case 'duplizieren': {
        const [kopie] = kopieMitNeuenIds([block]);
        if (kopie) this.struktur((b) => einfuegen(b, kopie, { nachId: id }), { blockId: kopie.id });
        return;
      }
      case 'loeschen':
        this.loeschen(id);
        return;
      default:
    }
  }

  // ------------------------------------------------------------------
  // Formatierung (Fett, Kursiv, Highlight, Link)
  // ------------------------------------------------------------------

  /** Live-Selektion in einer Blockzelle: { zelle, ort, start, end } (Raw-Offsets). */
  selektionInZelle() {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return null;
    const zelle = this.blockZelle(sel.anchorNode);
    if (!zelle || zelle !== this.blockZelle(sel.focusNode)) return null;
    const raw = htmlToInlineMd(zelle);
    const offsets = domSelectionToRaw(zelle, renderBlockMd(raw).toRaw);
    if (!offsets) return null;
    return { zelle, ort: this.ortVon(zelle), raw, start: offsets.start, end: offsets.end };
  }

  formatiereLive(format) {
    const s = this.selektionInZelle();
    if (!s || s.start === s.end) return false;
    this.formatiereZelle(s.zelle, s.start, s.end, (raw, a, b) => toggleInlineFormat(raw, a, b, format));
    return true;
  }

  /** Farbige Hervorhebung auf der Live-Auswahl (farbe leer/gleiche Farbe = entfernen). */
  highlightFarbeLive(farbe, gespeichert = null) {
    const s = gespeichert
      ? { zelle: this.zelleFuerOrt(gespeichert.ort), start: gespeichert.start, end: gespeichert.end }
      : this.selektionInZelle();
    if (!s?.zelle || s.start === s.end) return false;
    this.formatiereZelle(s.zelle, s.start, s.end, (raw, a, b) => setzeHighlightFarbe(raw, a, b, farbe));
    return true;
  }

  /** Eintrag aus dem Selektions-Menue (Offsets aus checkSelection). */
  formatiereAusMenue(aktion) {
    const v = this.view;
    const format = FORMAT_AKTIONEN[aktion];
    const sel = v.blockSelektion;
    v.blockSelektion = null;
    if (!format || !sel) return;
    const zelle = this.zelleFuerOrt(sel.ort);
    if (zelle) this.formatiereZelle(zelle, sel.start, sel.end, (raw, a, b) => toggleInlineFormat(raw, a, b, format));
  }

  linkSetzen(ort, start, end, url) {
    const zelle = this.zelleFuerOrt(ort);
    if (zelle) this.formatiereZelle(zelle, start, end, (raw, a, b) => setzeLink(raw, a, b, url));
  }

  formatiereZelle(zelle, start, end, fn) {
    const ort = this.ortVon(zelle);
    const raw = htmlToInlineMd(zelle);
    if (start > raw.length || end > raw.length) return;
    const res = fn(raw, start, end);
    if (!res || res.text === raw) return;
    this.merkeStand();
    const gerendert = renderBlockMd(res.text);
    zelle.innerHTML = gerendert.html;
    this.bloecke = this.bloecke.map((b) => (b.id === ort.blockId ? mitWert(b, ort, res.text) : b));
    this.tippGruppe = { key: null, zeit: 0 };
    this.geaendert();
    zelle.focus({ preventScroll: true });
    try { selectRawRange(zelle, gerendert.toRendered, res.start, res.end); } catch (_) { /* Auswahl egal */ }
  }

  // ------------------------------------------------------------------
  // Bilder
  // ------------------------------------------------------------------

  async bilderEinfuegen(dateien, ziel = null) {
    const skriptId = this.skriptId;
    let position = ziel;
    for (const file of dateien) {
      const fehler = pruefeSkriptBild(file);
      if (fehler) {
        window.toastSystem?.error(fehler);
        continue;
      }
      this.uploads += 1;
      this.view._toolbar?.aktualisieren();
      try {
        const { blob, breite, hoehe } = await verkleinereBild(file);
        const pfad = await skripteService.uploadSkriptBild(skriptId, blob);
        if (skriptId !== this.skriptId) return;
        const block = neuerBlock('bild', { pfad, breite_px: breite, hoehe_px: hoehe });
        this.einfuegenBloecke(block, { ziel: position || this.einfuegeZiel(), fokus: { blockId: block.id } });
        position = { nachId: block.id };
      } catch (err) {
        window.toastSystem?.error(err.message || 'Bild konnte nicht hochgeladen werden.');
      } finally {
        this.uploads -= 1;
        this.view._toolbar?.aktualisieren();
      }
    }
  }
}
