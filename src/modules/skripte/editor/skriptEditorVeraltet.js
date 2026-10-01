// Veraltete Vorschlaege: nach dem Vorschlag wurde fuer dieselbe Zelle ein
// anderer Vorschlag angenommen. Rein aus den Messages berechnet (kein
// eigener Status), damit auch Jobs erfasst sind, die beim Annehmen noch liefen.

import { VISUELL_FIELD, GRID_SEKTIONEN } from './skriptEditorKonstanten.js';
import { masterSektionBody } from '../master/skriptMasterFormat.js';

/** Zielzelle einer Message: Grid-Feld, Visual-Feld oder Master-Slug. */
function zielZelle(m) {
  if (!m?.sektion || m.sektion === 'gesamt') return null;
  if (m.aktion === 'visuell' || m.ist_visuell) return VISUELL_FIELD[m.sektion] || null;
  return m.sektion;
}

/** Alle Zellen einer Message: eine oder die Liste aus aenderungen. */
function zielZellen(m) {
  const liste = Array.isArray(m?.aenderungen) ? m.aenderungen : [];
  if (liste.length) {
    return liste
      .map((a) => {
        const sektion = String(a?.sektion || '').trim();
        if (!sektion) return null;
        return sektion === 'titel' ? 'titel' : (a?.spalte === 'visuell' ? VISUELL_FIELD[sektion] : sektion);
      })
      .filter(Boolean);
  }
  const eine = zielZelle(m);
  return eine ? [eine] : [];
}

function aktuellerText(skript, zelle) {
  if (!skript || !zelle) return '';
  if (GRID_SEKTIONEN.includes(zelle) || Object.values(VISUELL_FIELD).includes(zelle)) {
    return skript[zelle] || '';
  }
  return masterSektionBody(skript.inhalt_md || '', zelle);
}

function zeit(wert) {
  const t = Date.parse(wert || '');
  return Number.isFinite(t) ? t : null;
}

export function istVeraltet(msg, messages, skript) {
  if (msg?.status !== 'vorschlag' || msg.aktion === 'rueckfrage' || msg.aktion === 'visuell') return false;
  const zellen = zielZellen(msg);
  const erstellt = zeit(msg.created_at);
  if (!zellen.length || erstellt == null) return false;

  // Mehrere Zellen: ein spaeterer Accept auf irgendeiner davon macht das
  // ganze Bundle veraltet. Eine halbe Uebernahme wuerde die Anweisung
  // (z.B. ein Verbot) in den uebrigen Zellen stehen lassen.
  const spaeterAngenommen = (messages || []).some((o) => o.id !== msg.id
    && o.status === 'angenommen'
    && zielZellen(o).some((z) => zellen.includes(z))
    && (zeit(o.updated_at) ?? 0) > erstellt);
  if (!spaeterAngenommen) return false;

  if (zellen.length > 1) return true;
  if (!msg.selektion_text) return true;
  return !aktuellerText(skript, zellen[0]).includes(msg.selektion_text);
}
