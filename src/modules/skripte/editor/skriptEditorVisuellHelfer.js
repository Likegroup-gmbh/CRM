// skriptEditorVisuellHelfer.js
// Reine Helfer fuer den Skript-Editor: Visual-Ketten-Logik (Vorgaenger/
// Nachfolger), Sektions-Anzeigenamen und Stand-Snapshots fuer Versionen.

import {
  SEKTION_LABELS, SEKTION_LABELS_KURZ, VISUELL_VORGAENGER, VISUELL_NACHFOLGER
} from './skriptEditorKonstanten.js';

export function visuellVorgaengerFeld(sektion) {
  return VISUELL_VORGAENGER[sektion] || null;
}

export function visuellVorgaengerFehlt(skript, sektion) {
  const feld = visuellVorgaengerFeld(sektion);
  return !!(feld && !(skript?.[feld] || '').trim());
}

/**
 * Eine Guard-Komposition fuer beide Seiten: der DocRenderer fragt
 * "Button disabled?", die Visuell-Aktion "darf starten (und warum nicht)?".
 * Liefert null (frei) oder einen Grund-Code, damit die Aktion gezielt
 * toasten kann statt die Bedingungen nochmal zu pflegen.
 */
export function visuellGuardGrund(skript, sektion, { readonly = false, messages = [] } = {}) {
  if (readonly || !skript) return 'readonly';
  if (!['hook', 'hauptteil', 'cta'].includes(sektion)) return 'sektion';
  if (!(skript[sektion] || '').trim()) return 'leer';
  if (visuellVorgaengerFehlt(skript, sektion)) return 'vorgaenger';
  const laeuft = (messages || []).some((m) => m.aktion === 'visuell'
    && m.sektion === sektion && (m.status === 'pending' || m.status === 'running'));
  if (laeuft) return 'laeuft';
  return null;
}

export function visuellDisabled(skript, sektion, opts) {
  return visuellGuardGrund(skript, sektion, opts) !== null;
}

export function visuellVorgaengerTitle(sektion) {
  const feld = visuellVorgaengerFeld(sektion);
  if (!feld) return 'Was zu sehen ist per KI generieren';
  const vorgaenger = feld.replace('_visuell', '');
  const label = SEKTION_LABELS_KURZ[vorgaenger] || vorgaenger;
  return `Erst „Was zu sehen ist“ für ${label} generieren – die Zeiten bauen aufeinander auf.`;
}

export function visuellHatFolgeSektionen(skript, sektion) {
  return (VISUELL_NACHFOLGER[sektion] || []).some((feld) => (skript?.[feld] || '').trim());
}

export function sektionAnzeige(sektion, istVisuell) {
  const base = SEKTION_LABELS[sektion] || sektion;
  return istVisuell ? `${base} Visual` : base;
}

export function sektionAnzeigeKurz(sektion, istVisuell) {
  const base = SEKTION_LABELS_KURZ[sektion] || sektion;
  return istVisuell ? `${base} Visual` : base;
}

export function skriptStand(s) {
  if (!s) return null;
  return {
    titel: s.titel,
    hook: s.hook,
    hauptteil: s.hauptteil,
    cta: s.cta,
    hook_visuell: s.hook_visuell,
    hauptteil_visuell: s.hauptteil_visuell,
    cta_visuell: s.cta_visuell
  };
}

export function manuellBeschreibung(feld) {
  const sektion = feld.replace('_visuell', '');
  const kurz = SEKTION_LABELS_KURZ[sektion] || sektion;
  return feld.endsWith('_visuell') ? `Manuell · ${kurz} Visual` : `Manuell · ${kurz}`;
}
