// videoBrowserLogic.js
// Reine Logik des Videos-Tabs (Spaltenbrowser): Baum aus den vorhandenen Tabellen,
// Ablaufschritt, Auswahl, URL, Vorschau-Rahmen. Kein DOM, kein Supabase.
//
// Abbildung auf die Domäne (CONTEXT.md):
//   Kooperation -> Kooperationsvideo (Video-Nr) -> Ordner -> Datei
//   Ordner: Rohmaterial (an der Kooperation), Feedbackschleife 1..3, Finale Version
//   Dateien: Videos, Bilder und Stories des Videos, gruppiert innerhalb derselben Runde

export * from './videoBrowserFormat.js';
export * from './videoBrowserStatus.js';
export * from './videoBrowserSelection.js';
export * from './videoBrowserCommentData.js';
export * from './videoBrowserRow.js';
export * from './videoBrowserTree.js';
export * from './videoBrowserGroups.js';
export * from './videoBrowserTagLogic.js';
export * from './videoBrowserShowcaseLogic.js';
