import { describe, it, expect } from 'vitest';
import { renderItemRow } from '../modules/creator-auswahl/castingItemRow.js';
import {
  engagementDesEintrags,
  formatEngagement,
  bioDesEintrags
} from '../modules/creator-auswahl/castingEngagement.js';
import { notizNachAbruf, computeEngagementRate } from '../../netlify/functions/_shared/instagram-engagement.js';
import { openCastingDetailDrawer, closeCastingDetailDrawer } from '../modules/creator-auswahl/castingDetailDrawer.js';

function rowDoc(item = {}, ctx = {}) {
  const html = renderItemRow(
    { isKunde: false, hiddenColumns: [], canEdit: true, canCreate: true, canDelete: true, ...ctx },
    { id: 'i1', ...item },
    0
  );
  return new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
}

describe('Engagement-Rate im Casting', () => {
  it('formatiert wie in der Creator-Datenbank', () => {
    expect(formatEngagement(2.456)).toBe('2,46 %');
    expect(formatEngagement(null)).toBeNull();
  });

  it('nimmt die Rate vom Abruf und zeigt die bereinigte nur bei Abstand', () => {
    const mitGate = engagementDesEintrags({
      ig_stats: { engagement_rate: 3.2, engagement_rate_clean: 2.1, trial_gate: { aktiv: true } },
      creator: { ig_engagement_rate: 9 }
    });
    expect(mitGate.rate).toBe(3.2);
    expect(mitGate.showClean).toBe(true);

    const gleich = engagementDesEintrags({
      ig_stats: { engagement_rate: 3.2, engagement_rate_clean: 3.2, trial_gate: { aktiv: true } }
    });
    expect(gleich.showClean).toBe(false);
  });

  it('faellt auf den verknuepften Creator zurueck, solange der Abruf keine Rate hat', () => {
    const fallback = engagementDesEintrags({
      ig_stats: { biography: 'Bio' },
      creator: { ig_engagement_rate: 1.5, ig_engagement_rate_clean: 1.2, ig_trial_gate: { aktiv: true } }
    });
    expect(fallback.rate).toBe(1.5);
    expect(fallback.showClean).toBe(true);
  });

  it('zeigt die Rate in der Spalte neben den Followern', () => {
    const doc = rowDoc({
      ig_stats: { engagement_rate: 4.2, engagement_rate_clean: 3, trial_gate: { aktiv: true } }
    });
    const zelle = doc.querySelector('td.cp-col-engagement-ig');
    expect(zelle.textContent).toContain('4,2 %');
    expect(zelle.textContent).toContain('ohne Trials');
  });
});

describe('Kurzbeschreibung beim Instagram-Abruf', () => {
  it('laesst einen vorhandenen Text stehen', () => {
    expect(notizNachAbruf('Passt zur Zielgruppe', 'Bio vom Profil')).toBeNull();
  });

  it('setzt die Bio nur in eine leere Kurzbeschreibung', () => {
    expect(notizNachAbruf('', 'Bio vom Profil')).toBe('Bio vom Profil');
    expect(notizNachAbruf('   ', '  ')).toBeNull();
  });

  it('rechnet die Rate wie den Durchschnitt aus Likes und Kommentaren', () => {
    const rate = computeEngagementRate([
      { like_count: 10, comments_count: 0 },
      { like_count: 30, comments_count: 10 }
    ], 1000);
    expect(rate).toBe(2.5);
  });
});

describe('Auge und Schublade', () => {
  it('legt das Auge auf das Profilbild', () => {
    const doc = rowDoc({ name: 'Ada' });
    const bild = doc.querySelector('td.cp-col-bild');
    expect(bild.querySelector('[data-open-casting-detail="i1"]')).not.toBeNull();
    expect(doc.querySelector('td.cp-col-name [data-open-casting-detail]')).toBeNull();
  });

  it('setzt das Auge an den Namen, wenn die Bild-Spalte aus ist', () => {
    const doc = rowDoc({ name: 'Ada' }, { hiddenColumns: ['cp-col-bild'] });
    expect(doc.querySelector('td.cp-col-name [data-open-casting-detail="i1"]')).not.toBeNull();
  });

  it('zeigt Bio und Kurzbeschreibung getrennt und blendet die Mail fuer Kunden aus', () => {
    const detail = {
      isKunde: true,
      canEdit: false,
      gastReadonly: false,
      liste: { plattformen: 'instagram' },
      items: [{
        id: 'i1',
        name: 'Ada',
        notiz: 'Passt zur Zielgruppe',
        email: 'geheim@example.com',
        ig_stats: { biography: 'Bio vom Profil', engagement_rate: 2, media_count: 10 }
      }]
    };

    openCastingDetailDrawer(detail, 'i1');
    const drawer = document.getElementById('casting-detail-drawer');
    expect(drawer.textContent).toContain('Bio vom Profil');
    expect(drawer.textContent).toContain('Passt zur Zielgruppe');
    expect(drawer.textContent).not.toContain('geheim@example.com');
    expect(drawer.querySelector('[data-field="name"]')).toBeNull();
    closeCastingDetailDrawer({ immediate: true });
  });

  it('zeigt das Profilbild, sonst die Initiale', () => {
    const mitBild = {
      isKunde: false,
      canEdit: true,
      gastReadonly: false,
      liste: {},
      items: [{ id: 'i1', name: 'Ada', profile_image_url: 'https://cdn.test/ada.avif' }]
    };
    openCastingDetailDrawer(mitBild, 'i1');
    expect(document.querySelector('#casting-detail-drawer .casting-detail-bild img')?.getAttribute('src'))
      .toBe('https://cdn.test/ada.avif');
    closeCastingDetailDrawer({ immediate: true });

    const ohneBild = {
      ...mitBild,
      items: [{ id: 'i1', name: 'Ada' }]
    };
    openCastingDetailDrawer(ohneBild, 'i1');
    expect(document.querySelector('#casting-detail-drawer .casting-detail-bild')?.textContent).toBe('A');
    closeCastingDetailDrawer({ immediate: true });
  });

  it('macht den Namen im Kopf zum Textfeld', () => {
    const detail = {
      isKunde: false,
      canEdit: true,
      gastReadonly: false,
      liste: {},
      items: [{ id: 'i1', name: 'Ada', notiz: 'Grund' }]
    };
    openCastingDetailDrawer(detail, 'i1');
    const name = document.querySelector('#casting-detail-drawer [data-field="name"]');
    expect(name?.value).toBe('Ada');
    expect(document.querySelectorAll('#casting-detail-drawer [data-field="name"]')).toHaveLength(1);
    closeCastingDetailDrawer({ immediate: true });
  });
});

describe('Bio des Eintrags', () => {
  it('bevorzugt die Bio aus dem Abruf', () => {
    expect(bioDesEintrags({
      ig_stats: { biography: 'Vom Abruf' },
      creator: { ig_biography: 'Aus dem CRM' }
    })).toBe('Vom Abruf');
  });
});
