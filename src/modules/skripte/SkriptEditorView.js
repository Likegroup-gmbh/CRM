// SkriptEditorView.js
// Skript-Editor (3 Spalten in einer Shell, nach Figma):
//   links   Skriptliste zum Umschalten
//   mitte   Skript (Hook/Hauptteil/CTA) mit Selektions-Menue
//   rechts  Feedback-Panel: Kommentar-Threads an markierten Stellen
// Der AI-Chat ("Liky") laeuft in der ChatPanelShell (src/core/chat).
// Entry: Klasse aus dem Core, Verhalten aus den Prototype-Mixins.

import { SkriptEditorView } from './editor/SkriptEditorViewCore.js';
import './editor/SkriptEditorLifecycle.js';
import './editor/SkriptEditorListe.js';
import './editor/SkriptEditorDokument.js';
import './editor/SkriptEditorLiky.js';

export { SkriptEditorView };
