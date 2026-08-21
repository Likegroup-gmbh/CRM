// SkriptEditorVisuell.js
// Visual-Generierung ("Was zu sehen ist"): KI-Vorschlag pro Sektion,
// Auto-Apply direkt in die Zelle (kein Annehmen/Ablehnen).
// Button oeffnet ein Modus-Menue (selmenu-Stil), danach startet die Generierung.

import { skripteService } from '../SkripteService.js';
import { SEKTION_LABELS_KURZ, VISUELL_FIELD } from './skriptEditorKonstanten.js';
import { visuellGuardGrund, visuellVorgaengerTitle, visuellHatFolgeSektionen, skriptStand } from './skriptEditorVisuellHelfer.js';
import { openFloatingMenu } from '../../../core/components/FloatingMenu.js';

export class SkriptEditorVisuell {
  constructor(view) {
    this.view = view;
  }

  /** Guards + Toasts. true = Generierung darf starten / Menue darf aufgehen. */
  pruefeGuards(sektion) {
    const v = this.view;
    // Komposition aus dem Helfer - der Renderer nutzt dieselbe fuer disabled
    const grund = visuellGuardGrund(v.skript, sektion, { readonly: v.isReadonly, messages: v.messages });
    if (!grund) return true;
    if (grund === 'leer') {
      window.toastSystem?.warning('Erst gesprochenen Text generieren – dann kann ich das Visual dazu bauen.');
    } else if (grund === 'vorgaenger') {
      window.toastSystem?.warning(visuellVorgaengerTitle(sektion));
    }
    return false;
  }

  /** Visual-Button: Guards, dann Modus-Menue – oder Direktstart wenn keine Modi. */
  openModusMenu(btn) {
    const v = this.view;
    const sektion = btn?.dataset?.sektion;
    if (!this.pruefeGuards(sektion)) return;

    const modi = v.modi || [];
    if (!modi.length) {
      this.startVisuell(sektion, 'klassisch');
      return;
    }

    const menu = document.getElementById('ed-modmenu');
    if (!menu) {
      this.startVisuell(sektion, 'klassisch');
      return;
    }

    const selmenu = document.getElementById('ed-selmenu');
    if (selmenu) selmenu.hidden = true;
    v.closeVersionMenu();

    openFloatingMenu({
      el: menu,
      anchor: btn,
      wrap: v.container?.querySelector('.skripte-editor'),
      layout: 'icon-label-sub',
      items: modi.map((m) => ({
        id: m.slug,
        icon: m.icon || { klassisch: 'clapperboard', dynamisch: 'spark-doc' }[m.slug],
        label: m.name,
        subtext: m.beschreibung,
        layout: m.item_layout,
        data: { modus: m.slug }
      })),
      onSelect: (slug) => this.startVisuell(sektion, slug)
    });
  }

  async startVisuell(sektion, modus = 'klassisch') {
    const v = this.view;
    if (!this.pruefeGuards(sektion)) return;
    const gesprochen = (v.skript[sektion] || '').trim();
    const modusName = (v.modi || []).find((m) => m.slug === modus)?.name
      || (modus === 'dynamisch' ? 'Dynamisch' : 'Klassisch');

    const msg = await v.sendMessagePair({
      aktion: 'visuell',
      sektion,
      selektion_text: gesprochen,
      inhalt: `Visual zu ${SEKTION_LABELS_KURZ[sektion]} · ${modusName}`,
      modus
    });
    if (msg) v.renderDoc();
  }

  /** Nach Laden/Wechsel: offene Visual-Vorschlaege der Reihe nach uebernehmen. */
  async applyOffene() {
    const offen = this.view.messages.filter((m) =>
      m.aktion === 'visuell' && m.status === 'vorschlag' && m.vorschlag_text
    );
    for (const m of offen) {
      await this.applyVisuellVorschlag(m);
    }
  }

  /** Auto-Apply: Visual-Vorschlag direkt in die Zelle schreiben (kein Annehmen/Ablehnen). */
  async applyVisuellVorschlag(msg) {
    const v = this.view;
    if (v.visuellApplyLaeuft) return;
    if (msg.status !== 'vorschlag') return;
    const sektion = msg.sektion;
    const feld = VISUELL_FIELD[sektion];
    if (!feld || !msg.vorschlag_text) return;

    v.visuellApplyLaeuft = true;
    try {
      await v.inlineEdit.flush();
      const vorherigerStand = skriptStand(v.skript);

      await skripteService.updateSkript(v.skript.id, { [feld]: msg.vorschlag_text });
      v.skript[feld] = msg.vorschlag_text;

      const beschreibung = `Visual · ${SEKTION_LABELS_KURZ[sektion]}`;
      const neueVersion = await skripteService.createVersion(v.skript, beschreibung, vorherigerStand, v.aktiveVersion);
      v.aktiveVersion = neueVersion;
      v.skript.aktive_version_nr = neueVersion.version_nr;
      v.skript.aktive_sub_nr = neueVersion.sub_nr;
      v.versionen = await skripteService.getVersionen(v.skript.id);

      await skripteService.updateChatMessage(msg.id, { status: 'angenommen' });
      msg.status = 'angenommen';

      const focused = v.inlineEdit.focusedFeld();
      if (focused && focused !== feld) {
        const zelle = v.container?.querySelector(`[data-feld="${feld}"]`);
        if (zelle) zelle.textContent = msg.vorschlag_text;
        v.inlineEdit.syncSaved(feld, msg.vorschlag_text);
      } else {
        v.renderDoc();
      }
      v.renderChat();
      v.renderVersionSelect();
      window.toastSystem?.success(`Visual übernommen – jetzt ${skripteService.versionLabel(neueVersion)}`);
      if (visuellHatFolgeSektionen(v.skript, sektion)) {
        window.toastSystem?.warning('Zeitstempel der Folge-Sektionen passen evtl. nicht mehr – bei Bedarf neu generieren.');
      }
    } catch (err) {
      window.toastSystem?.error(err.message);
    } finally {
      v.visuellApplyLaeuft = false;
    }
  }
}
