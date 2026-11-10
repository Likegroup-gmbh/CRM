// blocksTastatur.js
// Eingabe, Fokus, Klicks, Tastatur (Enter, Backspace, Tab, Pfeile) und Einfuegen
// (Prototype-Mixin von SkriptEditorBlocks)

import {
  htmlToInlineMd, inlineMdText, domSelectionToRendered, renderedLength, teileInlineMd
} from '../../../../core/utils/inlineFormat.js';
import {
  TABELLE_MAX, neuerBlock, istTextBlock, istListenBlock, findeBlock, indexVon,
  einfuegen, entfernen, aendern, typWechseln, tabelleZeileEinfuegen
} from '../dokument/blockModell.js';
import { bildDateienAus } from '../dokument/skriptBild.js';
import { ersetze, mitWert, letzteZelleOrt } from './blockZellen.js';

const TIPP_GRUPPE_MS = 1500;

export const blocksTastaturMethoden = {
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
  },

  onFocusIn(e) {
    const blockEl = e.target.closest?.('[data-block-id]');
    if (blockEl) this.setAktiv(blockEl.dataset.blockId);
    const zelle = this.blockZelle(e.target);
    if (zelle?.dataset.blockFeld === 'zelle') {
      const ort = this.ortVon(zelle);
      this.letzteTabellenZelle = { blockId: ort.blockId, zeile: ort.zeile, spalte: ort.spalte };
    }
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },
};
