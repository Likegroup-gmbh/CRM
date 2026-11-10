// blocksAktionen.js
// Bloecke einfuegen/umbauen/loeschen, Griff-Menue und Inline-Formatierung
// (Prototype-Mixin von SkriptEditorBlocks)

import { openFloatingMenu } from '../../../../core/components/FloatingMenu.js';
import {
  htmlToInlineMd, toggleInlineFormat, setzeLink, setzeHighlightFarbe,
  domSelectionToRaw, selectRawRange
} from '../../../../core/utils/inlineFormat.js';
import {
  SKRIPT_TABELLE, BILD_BREITEN, neuerBlock, istTextBlock, istListenBlock,
  findeBlock, indexVon, einfuegen, entfernen, verschieben, aendern, typWechseln,
  tabelleZeileEinfuegen, tabelleZeileEntfernen, tabelleSpalteEinfuegen,
  tabelleSpalteEntfernen, kopieMitNeuenIds
} from '../dokument/blockModell.js';
import { renderBlockMd } from '../dokument/blockRenderer.js';
import { FORMAT_AKTIONEN } from '../skriptEditorKonstanten.js';
import { mitWert, ersteZelleOrt, letzteZelleOrt } from './blockZellen.js';

export const BILD_BREITE_LABEL = { klein: 'Klein', mittel: 'Mittel', voll: 'Volle Breite' };

export const blocksAktionenMethoden = {
  // ------------------------------------------------------------------
  // Aktionen (Toolbar, Griff-Menue, Selektions-Menue)
  // ------------------------------------------------------------------

  einfuegeZiel() {
    return this.aktiverBlock() ? { nachId: this.aktiverBlockId } : {};
  },

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
  },

  absatzNach(id) {
    const neu = neuerBlock('absatz');
    this.struktur((b) => einfuegen(b, neu, { nachId: id }), { blockId: neu.id, feld: 'md', offset: 0 });
  },

  schreibenAm(wo) {
    const rand = wo === 'anfang' ? this.bloecke[0] : this.bloecke.at(-1);
    if (rand?.typ === 'absatz' && !rand.md) {
      this.fokussiere({ blockId: rand.id, feld: 'md', offset: 0 });
      return;
    }
    const neu = neuerBlock('absatz');
    const ziel = wo === 'anfang' && rand ? { vorId: rand.id } : {};
    this.struktur((b) => einfuegen(b, neu, ziel), { blockId: neu.id, feld: 'md', offset: 0 });
  },

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
  },

  setzeIntern(id, intern) {
    const block = findeBlock(this.bloecke, id);
    if (!block || block.typ === SKRIPT_TABELLE) return;
    this.struktur((b) => aendern(b, id, { intern }), this.aktuellerFokus() || { blockId: id });
  },

  setzeBildBreite(id, breite) {
    const block = findeBlock(this.bloecke, id);
    if (block?.typ !== 'bild' || !BILD_BREITEN.includes(breite) || block.breite === breite) return;
    this.struktur((b) => aendern(b, id, { breite }), { blockId: id });
  },

  tabelleAendern(id, fn) {
    const block = findeBlock(this.bloecke, id);
    if (block?.typ !== 'tabelle') return;
    const tz = this.letzteTabellenZelle?.blockId === id ? this.letzteTabellenZelle : null;
    const neu = fn(block, tz);
    if (neu === block) return;
    this.letzteTabellenZelle = null;
    this.struktur((b) => b.map((x) => (x.id === id ? neu : x)), { blockId: id });
  },

  loeschen(id) {
    const block = findeBlock(this.bloecke, id);
    if (!block || block.typ === SKRIPT_TABELLE) return;
    const i = indexVon(this.bloecke, id);
    const nachbar = this.bloecke[i - 1] || this.bloecke[i + 1];
    this.struktur((b) => entfernen(b, id), nachbar && nachbar.typ !== SKRIPT_TABELLE ? letzteZelleOrt(nachbar) : null);
    window.toastSystem?.info('Block gelöscht. ⌘Z macht es rückgängig.');
  },

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
  },

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
  },

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
  },

  formatiereLive(format) {
    const s = this.selektionInZelle();
    if (!s || s.start === s.end) return false;
    this.formatiereZelle(s.zelle, s.start, s.end, (raw, a, b) => toggleInlineFormat(raw, a, b, format));
    return true;
  },

  /** Farbige Hervorhebung auf der Live-Auswahl (farbe leer/gleiche Farbe = entfernen). */
  highlightFarbeLive(farbe, gespeichert = null) {
    const s = gespeichert
      ? { zelle: this.zelleFuerOrt(gespeichert.ort), start: gespeichert.start, end: gespeichert.end }
      : this.selektionInZelle();
    if (!s?.zelle || s.start === s.end) return false;
    this.formatiereZelle(s.zelle, s.start, s.end, (raw, a, b) => setzeHighlightFarbe(raw, a, b, farbe));
    return true;
  },

  /** Eintrag aus dem Selektions-Menue (Offsets aus checkSelection). */
  formatiereAusMenue(aktion) {
    const v = this.view;
    const format = FORMAT_AKTIONEN[aktion];
    const sel = v.blockSelektion;
    v.blockSelektion = null;
    if (!format || !sel) return;
    const zelle = this.zelleFuerOrt(sel.ort);
    if (zelle) this.formatiereZelle(zelle, sel.start, sel.end, (raw, a, b) => toggleInlineFormat(raw, a, b, format));
  },

  linkSetzen(ort, start, end, url) {
    const zelle = this.zelleFuerOrt(ort);
    if (zelle) this.formatiereZelle(zelle, start, end, (raw, a, b) => setzeLink(raw, a, b, url));
  },

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
  },
};
