// skriptEditorKonstanten.js
// Konstanten fuer den Skript-Editor: Aktions-Labels/Icons, Sektions-Labels
// und Placeholder-Texte. Thinking-Labels kommen vom Job, nicht von hier.

import { icon } from '../../../core/icons/IconSystem.js';

export const AKTION_LABELS = {
  kommentieren: 'Kommentieren',
  neu_schreiben: 'Neu schreiben',
  kuerzen: 'Kürzen',
  laenger: 'Länger',
  anderer_ton: 'Anderer Ton',
  feedback: 'Feedback geben',
  chat: 'Chat',
  rueckfrage: 'Rückfrage',
  visuell: 'Visual',
  formatierung: 'Formatierung',
  fett: 'Fett',
  fett_entfernen: 'Fett entfernen',
  kursiv: 'Kursiv',
  kursiv_entfernen: 'Kursiv entfernen'
};

export const AKTION_ICONS = {
  kommentieren: icon('chat-bubble-left-ellipsis'),
  neu_schreiben: icon('rewrite'),
  kuerzen: icon('shorten'),
  laenger: icon('lengthen'),
  anderer_ton: icon('tone'),
  feedback: icon('chat-dots'),
  chat: '',
  formatierung: icon('note-edit'),
  fett: icon('bold'),
  // TODO: eigenes Bold-off-Icon, sobald geliefert
  fett_entfernen: icon('bold'),
  kursiv: icon('italic'),
  kursiv_entfernen: icon('italic-off')
};

/** AI-Aktionen des Selektionsmenues (nur intern). "kommentieren" sehen alle. */
export const AI_SELEKTION_AKTIONEN = ['neu_schreiben', 'kuerzen', 'laenger', 'anderer_ton'];

/** Format-Aktionen des Formatierung-Submenues -> Format ('bold'|'italic'). */
export const FORMAT_AKTIONEN = {
  fett: 'bold',
  fett_entfernen: 'bold',
  kursiv: 'italic',
  kursiv_entfernen: 'italic'
};

export const SEND_ICON = '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M231.87,114l-168-95.89A16,16,0,0,0,40.92,37.34L71.55,128,40.92,218.67A16,16,0,0,0,56,240a16.15,16.15,0,0,0,7.93-2.1l167.92-96.05a16,16,0,0,0,.05-27.89ZM56,224a.56.56,0,0,0,0-.12L85.74,136H144a8,8,0,0,0,0-16H85.74L56.06,32.16A.46.46,0,0,0,56,32l168,95.83Z"></path></svg>';

export const SEKTION_LABELS = { hook: 'HOOK', hauptteil: 'HAUPTTEIL', cta: 'CTA', gesamt: 'GESAMT' };
export const SEKTION_LABELS_KURZ = { hook: 'Hook', hauptteil: 'Hauptteil', cta: 'CTA' };
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
