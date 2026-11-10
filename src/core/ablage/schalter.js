// schalter.js
// Medienablage-Schalter für den Videos-Tab (Wert in schalter.json, gleiche Datei liest der Server).
// dropboxUpload = true: alter Dropbox-Weg. Der SharePoint-Code bleibt aus jedem Pfad: keine
// ablage-Spalten in den Abfragen (auf Live fehlt Migration 20261201), kein ablage-upload-ziel.
// Nur bis zum Stichtag: danach wären SharePoint-Dateien unsichtbar, der Rückweg ist der Notschalter.
// VITE_DROPBOX_UPLOAD=on|off übersteuert die Datei (Tests, Staging-Site) und wirkt erst nach neuem Build.

import schalter from './schalter.json';

const env = String(import.meta.env.VITE_DROPBOX_UPLOAD || '').toLowerCase();

export const DROPBOX_UPLOAD = env === 'on' ? true : env === 'off' ? false : schalter.dropboxUpload !== false;
