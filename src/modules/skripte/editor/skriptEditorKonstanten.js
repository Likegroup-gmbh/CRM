// skriptEditorKonstanten.js
// Konstanten fuer den Skript-Editor: Aktions-Labels/Icons, Sektions-Labels
// und Placeholder-Texte. Thinking-Labels kommen vom Job, nicht von hier.

import { icon } from '../../../core/icons/IconSystem.js';

export const AKTION_LABELS = {
  kommentieren: 'Kommentieren',
  neu_schreiben: 'Neu formulieren',
  neue_geschichte: 'Neue Geschichte',
  kuerzen: 'Kürzen',
  laenger: 'Länger',
  anderer_ton: 'Anderer Ton',
  feedback: 'Feedback geben',
  chat: 'Chat',
  rueckfrage: 'Rückfrage',
  visuell: 'Visual',
  hook_uebertragen: 'Hook übertragen',
  formatierung: 'Formatierung',
  fett: 'Fett',
  fett_entfernen: 'Fett entfernen',
  kursiv: 'Kursiv',
  kursiv_entfernen: 'Kursiv entfernen'
};

export const AKTION_ICONS = {
  kommentieren: icon('chat-bubble-left-ellipsis'),
  neu_schreiben: icon('rewrite'),
  neue_geschichte: icon('rewrite'),
  kuerzen: icon('shorten'),
  laenger: icon('lengthen'),
  anderer_ton: icon('tone'),
  feedback: icon('chat-dots'),
  chat: '',
  hook_uebertragen: icon('hook-transfer'),
  formatierung: icon('note-edit'),
  fett: icon('bold'),
  // TODO: eigenes Bold-off-Icon, sobald geliefert
  fett_entfernen: icon('bold'),
  kursiv: icon('italic'),
  kursiv_entfernen: icon('italic-off')
};

/** AI-Aktionen des Selektionsmenues (nur intern). "kommentieren" sehen alle. */
export const AI_SELEKTION_AKTIONEN = ['neu_schreiben', 'neue_geschichte', 'kuerzen', 'laenger', 'anderer_ton'];

/** Format-Aktionen des Formatierung-Submenues -> Format ('bold'|'italic'). */
export const FORMAT_AKTIONEN = {
  fett: 'bold',
  fett_entfernen: 'bold',
  kursiv: 'italic',
  kursiv_entfernen: 'italic'
};

export const SEND_ICON = icon('send');
export const STOP_ICON = icon('stop');

export const SEKTION_LABELS = {
  hook: 'HOOK', hauptteil: 'HAUPTTEIL', cta: 'CTA', gesamt: 'GESAMT', titel: 'TITEL',
  hook_variante_1: 'HOOK 1', hook_variante_2: 'HOOK 2', hook_variante_3: 'HOOK 3',
  rezept: 'REZEPT', text_hook: 'TEXT-HOOK'
};
export const SEKTION_LABELS_KURZ = {
  hook: 'Hook', hauptteil: 'Hauptteil', cta: 'CTA', titel: 'Titel',
  hook_variante_1: 'Hook 1', hook_variante_2: 'Hook 2', hook_variante_3: 'Hook 3',
  rezept: 'Rezept', text_hook: 'Text-Hook'
};
export const HOOK_VARIANTE_FELDER = ['hook_variante_1', 'hook_variante_2', 'hook_variante_3'];
export const GRID_SEKTIONEN = ['hook', 'hauptteil', 'cta', ...HOOK_VARIANTE_FELDER];
export function hatHookVarianten(skript) {
  return HOOK_VARIANTE_FELDER.some((feld) => (skript?.[feld] || '').trim());
}
export const VISUELL_FIELD = { hook: 'hook_visuell', hauptteil: 'hauptteil_visuell', cta: 'cta_visuell' };
export const VISUELL_VORGAENGER = { hook: null, hauptteil: 'hook_visuell', cta: 'hauptteil_visuell' };
export const VISUELL_NACHFOLGER = {
  hook: ['hauptteil_visuell', 'cta_visuell'],
  hauptteil: ['cta_visuell'],
  cta: []
};

export const PLACEHOLDER_DEFAULT = 'Anweisung oder Frage…';
export const PLACEHOLDER_AKTION = 'Anweisung ergänzen (optional) – Enter startet';
export const PLACEHOLDER_NEU = 'Erst Skript generieren – danach kannst du hier verfeinern';
export const PLACEHOLDER_FRAGEN = 'Antwort auf die Rückfrage schreiben…';
