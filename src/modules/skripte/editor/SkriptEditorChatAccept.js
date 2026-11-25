// SkriptEditorChatAccept.js
// Vorschlaege annehmen: Einzelzelle, Mehr-Zellen-Auftrag, Master-Sektion und
// Hook-Variante uebertragen (Prototype-Mixin von SkriptEditorChatActions)

import { skripteService } from '../SkripteService.js';
import {
  AKTION_LABELS, VISUELL_FIELD, GRID_SEKTIONEN, HOOK_VARIANTE_FELDER, SEKTION_LABELS_KURZ
} from './skriptEditorKonstanten.js';
import { sektionAnzeige, sektionAnzeigeKurz, skriptStand } from './skriptEditorVisuellHelfer.js';
import { istMasterSkript, replaceMasterSektion, masterSektionBody } from '../master/skriptMasterFormat.js';
import { istVeraltet } from './skriptEditorVeraltet.js';

/** Zellen eines Mehr-Zellen-Auftrags: [{ feld, text }]. */
function aenderungZellen(msg) {
  const liste = Array.isArray(msg?.aenderungen) ? msg.aenderungen : [];
  return liste
    .map((a) => {
      const sektion = String(a?.sektion || '').trim();
      if (!sektion) return null;
      const feld = sektion === 'titel'
        ? 'titel'
        : (a?.spalte === 'visuell' ? VISUELL_FIELD[sektion] : sektion);
      if (!feld) return null;
      const text = String(a?.vorschlag_text || '').trim();
      return text ? { feld, text } : null;
    })
    .filter(Boolean);
}

export const chatAcceptMethoden = {
  async acceptVorschlag(msg) {
    const v = this.view;
    if (msg.aktion === 'visuell') return v.applyVisuellVorschlag(msg);
    // Doppelklick-Guard: parallele Accepts kollidieren auf version_nr
    if (v.acceptLaeuft) return;
    if (istVeraltet(msg, v.messages, v.skript)) {
      window.toastSystem?.error('Vorschlag ist veraltet – die Sektion wurde danach geändert');
      v.renderChat();
      return;
    }

    const zellen = aenderungZellen(msg);
    if (zellen.length) return this.acceptAenderungen(msg, zellen);

    const sektion = msg.sektion;
    const istTitel = sektion === 'titel';
    if (!istTitel && !GRID_SEKTIONEN.includes(sektion)) {
      if (istMasterSkript(v.skript)) {
        await this.acceptMasterVorschlag(msg);
        return;
      }
    }
    if ((!istTitel && !GRID_SEKTIONEN.includes(sektion)) || !msg.vorschlag_text) {
      window.toastSystem?.error('Vorschlag kann nicht zugeordnet werden');
      return;
    }

    const feld = istTitel ? 'titel' : (msg.ist_visuell ? VISUELL_FIELD[sektion] : sektion);
    if (!feld) {
      window.toastSystem?.error('Vorschlag kann nicht zugeordnet werden');
      return;
    }
    const alt = v.skript[feld] || '';
    let neu;
    if (istTitel) {
      neu = msg.vorschlag_text;
    } else if (msg.selektion_text && alt.includes(msg.selektion_text)) {
      neu = alt.replace(msg.selektion_text, msg.vorschlag_text);
    } else if (msg.selektion_text) {
      // Markierte Stelle existiert nicht mehr (Sektion wurde zwischenzeitlich
      // geaendert) -> nicht still die ganze Sektion ueberschreiben
      const res = await window.confirmationModal?.open({
        title: 'Markierte Stelle nicht mehr gefunden',
        message: `Die ursprünglich markierte Stelle kommt in der Sektion ${sektionAnzeige(sektion, msg.ist_visuell)} nicht mehr vor (wurde sie zwischenzeitlich geändert?). Soll der Vorschlag die GESAMTE Sektion ersetzen?`,
        confirmText: 'Gesamte Sektion ersetzen',
        danger: true
      });
      if (!res?.confirmed) return;
      neu = msg.vorschlag_text;
    } else {
      neu = msg.vorschlag_text;
    }

    const vorherigerStand = skriptStand(v.skript);

    await v.inlineEdit.flush();

    v.acceptLaeuft = true;
    const btns = v.container?.querySelectorAll(`[data-msg-id="${msg.id}"]`) || [];
    btns.forEach((b) => { b.disabled = true; });

    try {
      const festgezogen = this.mitFestgezogen(feld);
      const extra = this.abgeleitet({ ...v.skript, [feld]: neu }, [feld]);
      await skripteService.updateSkript(v.skript.id, { [feld]: neu, ...extra, festgezogen });
      v.skript[feld] = neu;
      Object.assign(v.skript, extra);

      const beschreibung = `${AKTION_LABELS[msg.aktion] || 'Änderung'} · ${sektionAnzeigeKurz(sektion, msg.ist_visuell)}`;
      const neueVersion = await skripteService.createVersion(v.skript, beschreibung, vorherigerStand, v.aktiveVersion);
      v.aktiveVersion = neueVersion;
      v.skript.aktive_version_nr = neueVersion.version_nr;
      v.skript.aktive_sub_nr = neueVersion.sub_nr;
      v.versionen = await skripteService.getVersionen(v.skript.id);

      await skripteService.updateChatMessage(msg.id, { status: 'angenommen' });
      msg.status = 'angenommen';
      msg.updated_at = new Date().toISOString();

      v.renderDoc();
      v.renderChat();
      v.renderVersionSelect();
      window.toastSystem?.success(`Übernommen – jetzt ${skripteService.versionLabel(neueVersion)}`);
    } catch (err) {
      window.toastSystem?.error(err.message);
      btns.forEach((b) => { b.disabled = false; });
    } finally {
      v.acceptLaeuft = false;
    }
  },

  /** Mehr-Zellen-Auftrag: alle Felder in einem Update, eine Version. */
  async acceptAenderungen(msg, zellen) {
    const v = this.view;
    const vorherigerStand = skriptStand(v.skript);
    await v.inlineEdit.flush();
    v.acceptLaeuft = true;
    const btns = v.container?.querySelectorAll(`[data-msg-id="${msg.id}"]`) || [];
    btns.forEach((b) => { b.disabled = true; });

    try {
      const patch = {};
      for (const z of zellen) patch[z.feld] = z.text;
      Object.assign(patch, this.abgeleitet({ ...v.skript, ...patch }, zellen.map((z) => z.feld)));
      const festgezogen = zellen.reduce((liste, z) => this.mitFestgezogen(z.feld, liste), null);
      await skripteService.updateSkript(v.skript.id, { ...patch, festgezogen });
      v.skript.festgezogen = festgezogen;
      Object.assign(v.skript, patch);

      const beschreibung = `${AKTION_LABELS[msg.aktion] || 'Änderung'} · ${zellen.length} Zellen`;
      const neueVersion = await skripteService.createVersion(v.skript, beschreibung, vorherigerStand, v.aktiveVersion);
      v.aktiveVersion = neueVersion;
      v.skript.aktive_version_nr = neueVersion.version_nr;
      v.skript.aktive_sub_nr = neueVersion.sub_nr;
      v.versionen = await skripteService.getVersionen(v.skript.id);

      await skripteService.updateChatMessage(msg.id, { status: 'angenommen' });
      msg.status = 'angenommen';
      msg.updated_at = new Date().toISOString();

      v.renderDoc();
      v.renderChat();
      v.renderVersionSelect();
      window.toastSystem?.success(`Übernommen – jetzt ${skripteService.versionLabel(neueVersion)}`);
    } catch (err) {
      window.toastSystem?.error(err.message);
      btns.forEach((b) => { b.disabled = false; });
    } finally {
      v.acceptLaeuft = false;
    }
  },

  async acceptMasterVorschlag(msg) {
    const v = this.view;
    if (v.acceptLaeuft) return;
    const sektion = msg.sektion;
    if (!sektion || sektion === 'gesamt' || !msg.vorschlag_text) {
      window.toastSystem?.error('Vorschlag kann nicht zugeordnet werden');
      return;
    }

    const alt = v.skript.inhalt_md || '';
    const body = masterSektionBody(alt, sektion);
    let neu;
    if (msg.selektion_text && body.includes(msg.selektion_text)) {
      neu = replaceMasterSektion(alt, sektion, msg.vorschlag_text, { selektion: msg.selektion_text });
    } else if (msg.selektion_text) {
      const res = await window.confirmationModal?.open({
        title: 'Markierte Stelle nicht mehr gefunden',
        message: `Die ursprünglich markierte Stelle kommt in „${sektion}“ nicht mehr vor. Soll der Vorschlag die gesamte Sektion ersetzen?`,
        confirmText: 'Gesamte Sektion ersetzen',
        danger: true
      });
      if (!res?.confirmed) return;
      neu = replaceMasterSektion(alt, sektion, msg.vorschlag_text);
    } else {
      neu = replaceMasterSektion(alt, sektion, msg.vorschlag_text);
    }
    if (!neu) {
      window.toastSystem?.error('Sektion nicht gefunden');
      return;
    }

    const vorherigerStand = skriptStand(v.skript);
    await v.inlineEdit.flush();
    v.acceptLaeuft = true;
    const btns = v.container?.querySelectorAll(`[data-msg-id="${msg.id}"]`) || [];
    btns.forEach((b) => { b.disabled = true; });

    try {
      await skripteService.updateSkript(v.skript.id, { inhalt_md: neu });
      v.skript.inhalt_md = neu;
      const beschreibung = `${AKTION_LABELS[msg.aktion] || 'Änderung'} · ${sektionAnzeigeKurz(sektion, false)}`;
      const neueVersion = await skripteService.createVersion(v.skript, beschreibung, vorherigerStand, v.aktiveVersion);
      v.aktiveVersion = neueVersion;
      v.skript.aktive_version_nr = neueVersion.version_nr;
      v.skript.aktive_sub_nr = neueVersion.sub_nr;
      v.versionen = await skripteService.getVersionen(v.skript.id);
      await skripteService.updateChatMessage(msg.id, { status: 'angenommen' });
      msg.status = 'angenommen';
      msg.updated_at = new Date().toISOString();
      v.renderDoc();
      v.renderChat();
      v.renderVersionSelect();
      window.toastSystem?.success(`Übernommen – jetzt ${skripteService.versionLabel(neueVersion)}`);
    } catch (err) {
      window.toastSystem?.error(err.message);
      btns.forEach((b) => { b.disabled = false; });
    } finally {
      v.acceptLaeuft = false;
    }
  },

  async hookUebertragen(feld) {
    const v = this.view;
    if (!v.skript || v.isReadonly) return;
    if (!HOOK_VARIANTE_FELDER.includes(feld)) return;
    if (v.acceptLaeuft) return;

    const variante = v.skript[feld] || '';
    if (!variante.trim()) return;

    const vorherigerStand = skriptStand(v.skript);
    await v.inlineEdit.flush();

    const haupt = v.skript.hook || '';
    v.acceptLaeuft = true;
    const stempel = this.abgeleitet({ ...v.skript, hook: variante }, ['hook']);
    const visuellVorher = Object.fromEntries(Object.keys(stempel).map((k) => [k, v.skript[k]]));
    try {
      v.skript.hook = variante;
      v.skript[feld] = haupt;
      Object.assign(v.skript, stempel);
      await skripteService.updateSkript(v.skript.id, { hook: variante, [feld]: haupt || null, ...stempel });
      const neueVersion = await skripteService.createVersion(
        v.skript,
        `${AKTION_LABELS.hook_uebertragen} · ${SEKTION_LABELS_KURZ[feld]}`,
        vorherigerStand,
        v.aktiveVersion
      );
      v.aktiveVersion = neueVersion;
      v.skript.aktive_version_nr = neueVersion.version_nr;
      v.skript.aktive_sub_nr = neueVersion.sub_nr;
      v.versionen = await skripteService.getVersionen(v.skript.id);
      v.renderDoc();
      v.renderVersionSelect();
      window.toastSystem?.success(`Übernommen – jetzt ${skripteService.versionLabel(neueVersion)}`);
    } catch (err) {
      window.toastSystem?.error(err.message);
      v.skript.hook = haupt;
      v.skript[feld] = variante;
      Object.assign(v.skript, visuellVorher);
    } finally {
      v.acceptLaeuft = false;
    }
  },
};
