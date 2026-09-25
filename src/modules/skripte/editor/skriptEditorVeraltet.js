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
  const zelle = zielZelle(msg);
  const erstellt = zeit(msg.created_at);
  if (!zelle || erstellt == null) return false;

  const spaeterAngenommen = (messages || []).some((o) => o.id !== msg.id
    && o.status === 'angenommen'
    && zielZelle(o) === zelle
    && (zeit(o.updated_at) ?? 0) > erstellt);
  if (!spaeterAngenommen) return false;

  if (!msg.selektion_text) return true;
  return !aktuellerText(skript, zelle).includes(msg.selektion_text);
}
