// blocksDragBilder.js
// Bloecke per Griff verschieben, Bilder ablegen/einfuegen und hochladen
// (Prototype-Mixin von SkriptEditorBlocks)

import { skripteService } from '../../SkripteService.js';
import { neuerBlock, verschiebenZu } from '../dokument/blockModell.js';
import { pruefeSkriptBild, verkleinereBild, bildDateienAus } from '../dokument/skriptBild.js';

export const blocksDragBilderMethoden = {
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
  },

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
  },

  zeigeDropMarke(ziel) {
    this.root?.querySelectorAll('.is-drop-vor, .is-drop-nach')
      .forEach((el) => el.classList.remove('is-drop-vor', 'is-drop-nach'));
    if (ziel && ziel.id !== this.dragId) ziel.el.classList.add(ziel.position === 'vor' ? 'is-drop-vor' : 'is-drop-nach');
  },

  onDragOver(e) {
    const mitDateien = [...(e.dataTransfer?.types || [])].includes('Files');
    if (!this.dragId && !mitDateien) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = this.dragId ? 'move' : 'copy';
    this.zeigeDropMarke(this.dropZiel(e));
  },

  onDragLeave(e) {
    if (!e.relatedTarget || !this.root.contains(e.relatedTarget)) this.zeigeDropMarke(null);
  },

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
  },

  dragEnde() {
    this.dragId = null;
    this.root?.querySelectorAll('.is-dragging').forEach((el) => el.classList.remove('is-dragging'));
    this.zeigeDropMarke(null);
  },

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
  },
};
