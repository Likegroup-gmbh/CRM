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
