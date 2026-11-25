import { describe, it, expect } from 'vitest';
import { buildAuftragsdetailsPayload } from '../modules/auftrag/logic/AuftragsdetailsPayload.js';

function formFrom(html) {
  document.body.innerHTML = `<form id="f">${html}</form>`;
  return document.getElementById('f');
}

describe('buildAuftragsdetailsPayload', () => {
  it('überspringt unternehmen_id und art_der_kampagne', () => {
    const form = formFrom(`
      <input name="auftrag_id" value="a1">
      <input name="unternehmen_id" value="u1">
      <input name="art_der_kampagne" value="x">
      <input name="art_der_kampagne[]" value="y">
    `);
    const data = buildAuftragsdetailsPayload(form);
    expect(data).toEqual({ auftrag_id: 'a1' });
  });

  it('konvertiert Zahlenfelder und speichert leere Werte als null', () => {
    const form = formFrom(`
      <input name="ugc_paid_video_anzahl" value="7">
      <input name="gesamt_videos" value="12">
      <input name="kampagnenanzahl" value="3">
      <input name="abrechnung_hinweis" value="">
      <input name="ugc_paid_creator_anzahl" value="">
    `);
    const data = buildAuftragsdetailsPayload(form);
    expect(data.ugc_paid_video_anzahl).toBe(7);
    expect(data.gesamt_videos).toBe(12);
    expect(data.kampagnenanzahl).toBe(3);
    expect(data.abrechnung_hinweis).toBeNull();
    expect(data.ugc_paid_creator_anzahl).toBeNull();
  });

  it('nullt die Zahl bei deaktiviertem Video-Toggle und entfernt das Toggle-Feld', () => {
    const form = formFrom(`
      <input name="ugc_paid_video_anzahl" value="9">
      <input type="checkbox" name="ugc_paid_video_anzahl_enabled" value="on"
             data-video-toggle="true" data-target="ugc_paid_video_anzahl">
    `);
    const data = buildAuftragsdetailsPayload(form);
    expect(data.ugc_paid_video_anzahl).toBeNull();
    expect(data).not.toHaveProperty('ugc_paid_video_anzahl_enabled');
  });

  it('behält die Zahl bei aktivem Video-Toggle', () => {
    const form = formFrom(`
      <input name="ugc_paid_video_anzahl" value="9">
      <input type="checkbox" name="ugc_paid_video_anzahl_enabled" value="on" checked
             data-video-toggle="true" data-target="ugc_paid_video_anzahl">
    `);
    const data = buildAuftragsdetailsPayload(form);
    expect(data.ugc_paid_video_anzahl).toBe(9);
    expect(data).not.toHaveProperty('ugc_paid_video_anzahl_enabled');
  });

  it('entfernt Keys von Präfixen ohne DB-Spalten', () => {
    const form = formFrom(`
      <input name="auftrag_id" value="a1">
      <input name="whitelisting_budget" value="100">
      <input name="darkposting_budget" value="50">
    `);
    const data = buildAuftragsdetailsPayload(form);
    expect(data).not.toHaveProperty('whitelisting_budget');
    expect(data).not.toHaveProperty('darkposting_budget');
    expect(data.auftrag_id).toBe('a1');
  });
});
