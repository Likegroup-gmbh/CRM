// SkriptEditorEvents.js
// Shell-Events des Skript-Editors: Menues schliessen, Loeschen von aussen,
// Selektions-Menue und Chat-Eingabe (Prototype-Mixin).

import { backTarget } from '../../../core/breadcrumbTrail.js';
import { SkriptEditorView } from './SkriptEditorViewCore.js';

// Events: Selektion, Menue, Chat-Input. Einmal beim Oeffnen verdrahtet.
SkriptEditorView.prototype.bindEvents = function() {
  this.onDocMouseDown = (e) => {
    for (const id of ['ed-selmenu', 'ed-modmenu', 'ed-vermenu', 'ed-blockmenu', 'ed-toolbar-pop']) {
      const menu = document.getElementById(id);
      if (!menu || menu.hidden || menu.contains(e.target)) continue;
      if (id === 'ed-vermenu' && e.target.closest('#ed-version')) continue;
      if (id === 'ed-blockmenu' && e.target.closest('[data-block-griff]')) continue;
      if (id === 'ed-toolbar-pop' && e.target.closest('[data-tb-pop]')) continue;
      if (id === 'ed-vermenu') this.closeVersionMenu();
      else if (id === 'ed-toolbar-pop') this._toolbar.schliessen();
      else menu.hidden = true;
    }
  };
  document.addEventListener('mousedown', this.onDocMouseDown);

  // Skript geloescht (Menue, Button, anderer Tab im selben Fenster): das
  // geoeffnete zurueck zur Herkunft, ein anderes nur aus der Sidebar nehmen.
  this.onEntityUpdated = (e) => {
    const { entity, action, id } = e.detail || {};
    if (entity !== 'skripte' || action !== 'deleted' || !id) return;
    if (id === this.skript?.id) {
      window.navigateTo(backTarget('/skripte'));
      return;
    }
    this.skripte = this.skripte.filter((s) => s.id !== id);
    this.renderListe();
  };
  window.addEventListener('entityUpdated', this.onEntityUpdated);

  // Selektions-Menue: nach Mouseup pruefen, ob Auswahl in einer Sektion liegt.
  // Laeuft auch fuer Kunden - sie sehen im Menue nur "Kommentieren".
  // In Freien Bloecken (nur Team) zeigt es nur die Formatierung.
  if (this.kannKommentieren || this.kannBloeckeEditieren) {
    this.onMouseUp = (e) => {
      const menu = document.getElementById('ed-selmenu');
      if (!menu || menu.contains(e.target)) return;
      if (e.target.closest?.('#ed-toolbar, #ed-toolbar-pop, #ed-blockmenu')) return;
      // Timeout: Selection ist erst nach dem Event final
      setTimeout(() => this.checkSelection(), 10);
    };
    document.addEventListener('mouseup', this.onMouseUp);
  }

  if (!this.kannAiAktionen) return;
  const input = document.getElementById('ed-input');

  // Mini-WYSIWYG: Cmd/Ctrl+B/I direkt in den Grid-Zellen (nicht Master)
  const doc = document.getElementById('ed-doc');
  doc?.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
    const taste = e.key.toLowerCase();
    if (taste !== 'b' && taste !== 'i') return;
    const zelle = this._format.zelleFuer(e.target);
    if (!zelle || !doc.contains(zelle)) return;
    e.preventDefault();
    this._format.anwendenShortcut(zelle, taste === 'b' ? 'bold' : 'italic');
  });

  document.getElementById('ed-send')?.addEventListener('click', () => {
    if (this.likyLaeuft()) {
      this.stopLikyLauf();
      return;
    }
    this.sendChat();
  });
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Im Lauf nicht senden und nicht stoppen - getippter Text bleibt stehen
      if (this.likyLaeuft()) return;
      this.sendChat();
    }
    if (e.key === 'Escape') {
      this._toolbar.schliessen();
      const mod = document.getElementById('ed-modmenu');
      if (mod) mod.hidden = true;
      const sel = document.getElementById('ed-selmenu');
      if (sel) sel.hidden = true;
      this.closeVersionMenu();
      if (this.pendingAktion) this.clearPending();
    }
  });
};
