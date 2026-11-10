// SkriptEditorBlocks.js
// Skript-Dokument (ADR 0062): Freie Bloecke rund um die Skript-Tabelle
// bearbeiten. Nur das Team. Gespeichert wird die ganze Liste in
// skripte.dokument_bloecke mit Revisionszaehler: Last-Write-Wins, bei
// fremdem Zwischenstand fragt ein Dialog. Beim Neurendern der Bloecke
// wandert der DOM-Knoten der Skript-Tabelle mit, damit InlineEdit und
// offene Grid-Eingaben unberuehrt bleiben.
// Verhalten liegt in den Prototype-Mixins unter ./blocks.

import { skripteService } from '../SkripteService.js';
import { domSelectionToRendered, renderedLength, selectRenderedRange } from '../../../core/utils/inlineFormat.js';
import { SKRIPT_TABELLE_ID, normalisiereBloecke, findeBlock } from './dokument/blockModell.js';
import { dokumentHtml } from './dokument/blockRenderer.js';
import { zahl } from './blocks/blockZellen.js';
import { blocksPersistenzMethoden } from './blocks/blocksPersistenz.js';
import { blocksTastaturMethoden } from './blocks/blocksTastatur.js';
import { blocksAktionenMethoden } from './blocks/blocksAktionen.js';
import { blocksDragBilderMethoden } from './blocks/blocksDragBilder.js';

export { wertAn, mitWert } from './blocks/blockZellen.js';
export { BILD_BREITE_LABEL } from './blocks/blocksAktionen.js';

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

  get kannRueckgaengig() {
    const jetzt = JSON.stringify(this.bloecke);
    return this.undoStack.some((s) => s !== jetzt);
  }

  get kannWiederholen() {
    return this.redoStack.length > 0;
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
    // Vor jeder DOM-Mutation lesen: schon das Umhaengen der Skript-Tabelle kollabiert die Hoehe,
    // danach liefert scrollTop den vom Browser geklemmten Wert. min-height haelt die Hoehe beim Tausch.
    const scroller = this.root.closest('.skripte-editor-doc');
    const scrollTop = scroller?.scrollTop ?? 0;
    this.root.style.minHeight = `${this.root.offsetHeight}px`;
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
    this.root.style.minHeight = '';
    if (scroller) scroller.scrollTop = scrollTop;
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
      if (blockEl) this.haltSichtbar(blockEl);
      return;
    }
    const zelle = this.zelleFuerOrt(fokus);
    if (zelle) this.fokussiereZelle(zelle, fokus.offset);
  }

  fokussiereZelle(zelle, offset = 0) {
    // Selection setzen scrollt in contenteditable nativ (Caret-Into-View) -> vorher/nachher sichern
    const scroller = zelle.closest('.skripte-editor-doc');
    const scrollTop = scroller?.scrollTop ?? 0;
    zelle.focus({ preventScroll: true });
    const len = renderedLength(zelle);
    const pos = offset === 'ende' || offset == null ? len : Math.min(Math.max(0, offset), len);
    try { selectRenderedRange(zelle, pos); } catch (_) { /* leere Zelle */ }
    if (scroller) scroller.scrollTop = scrollTop;
    this.haltSichtbar(zelle);
  }

  // Wie scrollIntoView('nearest'), aber mit Rand: Caret klebt nicht am unteren/oberen Rand
  // (oben Platz fuer die sticky Toolbar).
  haltSichtbar(el, randOben = 72, randUnten = 16) {
    const scroller = el.closest('.skripte-editor-doc');
    if (!scroller) { el.scrollIntoView?.({ block: 'nearest' }); return; }
    const s = scroller.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.bottom > s.bottom - randUnten) scroller.scrollTop += r.bottom - (s.bottom - randUnten);
    else if (r.top < s.top + randOben) scroller.scrollTop -= (s.top + randOben) - r.top;
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
}

Object.assign(
  SkriptEditorBlocks.prototype,
  blocksPersistenzMethoden,
  blocksTastaturMethoden,
  blocksAktionenMethoden,
  blocksDragBilderMethoden
);
