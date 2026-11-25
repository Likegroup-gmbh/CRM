// AltbestandLinie.test.js
// Altbestand-Linie (ADR 0058): Briefing ohne Inhalt darf nirgends brechen, die Sperre
// greift, "Briefing ausfüllen" schaltet frei.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import {
  istAltbestand,
  zeigeAltbestandBadge,
  renderAltbestandHinweis,
  briefingAusfuellen,
  mountAltbestandHinweis,
} from '../modules/kampagne/altbestandLinie.js';
import { renderLinienSwitch } from '../modules/kampagne/linienScope.js';
import { BriefingDetail } from '../modules/briefing/BriefingDetail.js';
import { renderBriefingDoc, buildBriefingPdfModel } from '../modules/briefing/BriefingDocView.js';
import { ensureBriefingLine, linienFromBriefings } from '../modules/produktion/ProduktionService.js';
import { duplicateBriefing } from '../modules/briefing/duplicateBriefing.js';

const require = createRequire(import.meta.url);
const { buildBedarf, loadBedarfData } = require('../../netlify/functions/_shared/casting-match.js');
const { fmtCampaignBriefing, briefingSkriptSprache } = require('../../netlify/functions/_shared/skript-context.js');

/** So legt scripts/legacy-linien-migration.js die Zeile an: nur die Pflichtfelder. */
const LEERES_BRIEFING = {
  id: 'b-alt',
  unternehmen_id: 'u1',
  marke_id: null,
  kampagne_id: 'k1',
  produktion_id: 'p1',
  bereich: 'paid_creator_ads',
  aktivierung_name: 'Kampagne 9',
  is_draft: false,
  ist_altbestand: true,
  persona_ids: null,
  im_nischen: null,
  pa_nischen: null,
  pa_creator_merkmale: null,
  maerkte: null,
  sprachen: null,
  produkte: [],
  personas: [],
};

beforeEach(() => {
  window.isKunde = () => false;
  window.canEdit = () => true;
  window.canCreate = () => true;
});

afterEach(() => {
  delete window.isKunde;
  delete window.canEdit;
  delete window.canCreate;
  delete window.confirmationModal;
  delete window.supabase;
  delete window.toastSystem;
});

describe('leeres Altbestand-Briefing im Rendering', () => {
  it('Casting-Bedarf: kein Fehler, leerer Bedarf', () => {
    const bedarf = buildBedarf(LEERES_BRIEFING, { produktIds: [], personas: [] });
    expect(bedarf.nischen).toEqual([]);
    expect(bedarf.groessen).toEqual([]);
    expect(bedarf.voraussetzungen).toEqual([]);
    expect(bedarf.umsetzung).toBeNull();
  });

  it('Skript-Prompt: Briefing-Sektion und Sprache brechen nicht', () => {
    expect(() => fmtCampaignBriefing(LEERES_BRIEFING)).not.toThrow();
    expect(() => briefingSkriptSprache(LEERES_BRIEFING)).not.toThrow();
    const text = fmtCampaignBriefing(LEERES_BRIEFING);
    expect(typeof (text ?? '')).toBe('string');
  });

  it('Briefing-Dokument und PDF-Modell rendern ohne Fehler', () => {
    const detail = new BriefingDetail();
    detail.briefing = LEERES_BRIEFING;
    expect(() => renderBriefingDoc({ detail })).not.toThrow();
    expect(() => renderBriefingDoc({ detail, print: true })).not.toThrow();
    expect(() => buildBriefingPdfModel(detail)).not.toThrow();
  });
});

describe('Briefing-Tab und Linien-Switcher', () => {
  it('erkennt Altbestand an der Linie und am eingebetteten Briefing', () => {
    expect(istAltbestand({ ist_altbestand: true })).toBe(true);
    expect(istAltbestand({ briefing: { ist_altbestand: true } })).toBe(true);
    expect(istAltbestand({ ist_altbestand: false })).toBe(false);
    expect(istAltbestand(null)).toBe(false);
  });

  it('linienFromBriefings reicht das Flag durch', () => {
    const [linie] = linienFromBriefings([{ id: 'b1', aktivierung_name: 'X', ist_altbestand: true, created_at: '1' }]);
    expect(linie.ist_altbestand).toBe(true);
  });

  it('Badge "Altbestand" nur fuer Mitarbeiter', () => {
    const detail = { linien: [{ id: 'b1', name: 'Kampagne 9', ist_altbestand: true }], linieId: 'b1' };
    expect(renderLinienSwitch(detail, 'briefing')).toContain('Altbestand');
    window.isKunde = () => true;
    expect(renderLinienSwitch(detail, 'briefing')).not.toContain('Altbestand');
    expect(zeigeAltbestandBadge({ ist_altbestand: true })).toBe(false);
  });

  it('Hinweis mit Aktion fuer Mitarbeiter, neutral fuer Kunden, ohne Aktion ohne Recht', () => {
    expect(renderAltbestandHinweis()).toContain('Briefing ausfüllen');
    window.canEdit = () => false;
    expect(renderAltbestandHinweis()).not.toContain('Briefing ausfüllen');
    window.canEdit = () => true;
    window.isKunde = () => true;
    const kunde = renderAltbestandHinweis();
    expect(kunde).not.toContain('Altbestand');
    expect(kunde).not.toContain('Briefing ausfüllen');
  });
});

describe('Briefing ausfüllen', () => {
  function supabaseMock() {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    return { from, update, eq };
  }

  it('bricht ohne Bestaetigung ab und schreibt nichts', async () => {
    const mock = supabaseMock();
    window.supabase = mock;
    window.confirmationModal = { open: vi.fn(async () => ({ confirmed: false })) };
    expect(await briefingAusfuellen('b-alt')).toBe(false);
    expect(mock.update).not.toHaveBeenCalled();
  });

  it('setzt ist_altbestand auf false', async () => {
    const mock = supabaseMock();
    window.supabase = mock;
    window.confirmationModal = { open: vi.fn(async () => ({ confirmed: true })) };
    expect(await briefingAusfuellen('b-alt')).toBe(true);
    expect(mock.from).toHaveBeenCalledWith('campaign_briefings');
    expect(mock.update).toHaveBeenCalledWith({ ist_altbestand: false });
    expect(mock.eq).toHaveBeenCalledWith('id', 'b-alt');
  });

  it('der Button im Hinweis laedt die Linien nach dem Freischalten neu', async () => {
    window.supabase = supabaseMock();
    window.confirmationModal = { open: vi.fn(async () => ({ confirmed: true })) };
    const host = document.createElement('div');
    document.body.appendChild(host);
    const onFreigeschaltet = vi.fn();
    mountAltbestandHinweis(host, 'b-alt', { onFreigeschaltet });
    host.querySelector('[data-empty-action="briefing-ausfuellen"]').click();
    await vi.waitFor(() => expect(onFreigeschaltet).toHaveBeenCalledTimes(1));
    host.remove();
  });
});

describe('Sperren', () => {
  it('ensureBriefingLine laesst Altbestand-Linien in Ruhe', async () => {
    window.supabase = { from: vi.fn(() => { throw new Error('darf nichts lesen oder schreiben'); }) };
    const result = await ensureBriefingLine({ briefing: LEERES_BRIEFING, kampagneId: 'k1', produktionId: 'p1' });
    expect(result).toBeNull();
    expect(window.supabase.from).not.toHaveBeenCalled();
  });

  it('Duplizieren einer Altbestand-Linie wird abgelehnt', async () => {
    const maybeSingle = vi.fn(async () => ({ data: LEERES_BRIEFING, error: null }));
    window.supabase = { from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) })) };
    await expect(duplicateBriefing('b-alt')).rejects.toThrow(/Altbestand/);
  });

  it('Casting-Vorschlaege lehnen Altbestand-Linien ab', async () => {
    const supabase = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: LEERES_BRIEFING }) }) }) }),
    };
    await expect(loadBedarfData(supabase, { briefing_id: 'b-alt' })).rejects.toThrow(/Altbestand-Linie/);
  });
});
