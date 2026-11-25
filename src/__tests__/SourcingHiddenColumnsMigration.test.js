import { describe, it, expect } from 'vitest';
import { migrateHiddenColumns } from '../modules/creator-auswahl/sourcingSpaltenSichtbarkeit.js';

describe('migrateHiddenColumns', () => {
  it('entfernt die alten Status-Spalten aus gespeicherten Einstellungen', () => {
    expect(migrateHiddenColumns(['cp-col-onhold', 'cp-col-notiz'])).toEqual(['cp-col-notiz']);
  });

  it('versteckt die Status-Spalte nur, wenn vorher alle fuenf versteckt waren', () => {
    const alle = ['cp-col-onhold', 'cp-col-buchen', 'cp-col-prio1', 'cp-col-prio2', 'cp-col-absagen'];

    expect(migrateHiddenColumns(alle)).toEqual(['cp-col-status']);
    expect(migrateHiddenColumns(alle.slice(0, 4))).toEqual([]);
  });

  it('entfernt die abgeschafften CPM-Spalten', () => {
    expect(migrateHiddenColumns(['cp-col-cpm-ig', 'cp-col-cpm-tt', 'cp-col-vk'])).toEqual(['cp-col-vk']);
  });

  it('entfernt die o.-A.-Spalten und die beiden Checkbox-Spalten', () => {
    const alt = [
      'cp-col-cpm-ig-8-clean', 'cp-col-cpm-ig-30-clean',
      'cp-col-anfragen', 'cp-col-check', 'cp-col-notiz'
    ];

    expect(migrateHiddenColumns(alt)).toEqual(['cp-col-notiz']);
  });

  it('teilt die alte Links-Spalte weiterhin in IG und TT auf', () => {
    expect(migrateHiddenColumns(['cp-col-links'])).toEqual(expect.arrayContaining(['cp-col-link-ig', 'cp-col-link-tt']));
  });

  it('versteckt die neuen Plattformzeilen mit, wenn die Liste die Plattform nicht hat', () => {
    expect(migrateHiddenColumns(['cp-col-link-tt', 'cp-col-follower-tt'])).toEqual([
      'cp-col-link-tt', 'cp-col-follower-tt', 'cp-col-engagement-tt',
      'cp-col-views-tt-12', 'cp-col-cpm-tt-12', 'cp-col-views-tt-30', 'cp-col-cpm-tt-30'
    ]);
    expect(migrateHiddenColumns(['cp-col-link-ig'])).toEqual(['cp-col-link-ig', 'cp-col-engagement-ig']);
    expect(migrateHiddenColumns(['cp-col-notiz'])).toEqual(['cp-col-notiz']);
  });

  it('benennt die 8er-Schluessel auf 12 um und versteckt die Views wie ihren Preis', () => {
    expect(migrateHiddenColumns(['cp-col-cpm-ig-8', 'cp-col-notiz']))
      .toEqual(['cp-col-cpm-ig-12', 'cp-col-notiz', 'cp-col-views-ig-12']);
    expect(migrateHiddenColumns(['cp-col-cpm-8', 'cp-col-cpm-30']))
      .toEqual(['cp-col-cpm-12', 'cp-col-cpm-30', 'cp-col-views-12', 'cp-col-views-30']);
    expect(migrateHiddenColumns(['cp-col-cpm-tt-8', 'cp-col-cpm-tt-30']))
      .toEqual(['cp-col-cpm-tt-12', 'cp-col-cpm-tt-30', 'cp-col-views-tt-12', 'cp-col-views-tt-30']);
  });

  it('laesst die Views ohne 8er-Schluessel frei, damit sie einzeln einblendbar bleiben', () => {
    expect(migrateHiddenColumns(['cp-col-cpm-12', 'cp-col-cpm-ig-30'])).toEqual(['cp-col-cpm-12', 'cp-col-cpm-ig-30']);
  });

  it('kommt mit fehlenden Werten klar', () => {
    expect(migrateHiddenColumns(null)).toEqual([]);
    expect(migrateHiddenColumns(undefined)).toEqual([]);
  });
});
