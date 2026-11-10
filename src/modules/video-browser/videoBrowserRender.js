// videoBrowserRender.js
// HTML-Renderer des Videos-Tabs: Pfadleiste, Spalten, Detailbereich.
// Reine Funktionen (Zustand rein, String raus). Optik kommt ausschließlich aus
// assets/styles/video-browser.css (Design-Variablen und vorhandene Badge-Klassen).

export { statusBadge, pfadSegmente, renderPath } from './videoBrowserRenderParts.js';
export { renderColumns, uploadRowHtml } from './videoBrowserRenderColumns.js';
export { naechsterSchritt, renderDetail } from './videoBrowserRenderDetail.js';
export { commentHtml } from './videoBrowserRenderComments.js';
