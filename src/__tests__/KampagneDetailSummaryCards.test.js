import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasVideoStats,
  renderSummaryCards,
  updateSummaryCardsDOM,
  updateVideoStatsCardDOM
} from '../modules/kampagne/KampagneDetailSummaryCards.js';

function renderIntoDom(videoStats) {
  document.body.innerHTML = renderSummaryCards(
    { auftrag: { nettobetrag: 0, creator_budget: 0 } },
    0, 0, 0, 0, 0,
    videoStats
  );
}

describe('hasVideoStats', () => {
  it('ist false ohne Zahlen', () => {
    expect(hasVideoStats(null)).toBe(false);
    expect(hasVideoStats({ views: 0, likes: 0, comments: 0 })).toBe(false);
    expect(hasVideoStats({ videosMitDaten: 2, views: 0, likes: 0, comments: 0 })).toBe(false);
  });

  it('ist true sobald eine Metrik groesser 0 ist', () => {
    expect(hasVideoStats({ views: 12, likes: 0, comments: 0 })).toBe(true);
    expect(hasVideoStats({ views: 0, likes: 3, comments: 0 })).toBe(true);
    expect(hasVideoStats({ views: 0, likes: 0, comments: 1 })).toBe(true);
  });
});

describe('renderSummaryCards Live-Performance', () => {
  it('laesst die Karte weg wenn keine Stats da sind', () => {
    renderIntoDom({ views: 0, likes: 0, comments: 0 });
    expect(document.querySelector('[data-summary-card="video-stats"]')).toBeNull();
  });

  it('zeigt die Karte mit kompakten Zahlen wenn Stats da sind', () => {
    renderIntoDom({ views: 12500, likes: 320, comments: 18 });
    const card = document.querySelector('[data-summary-card="video-stats"]');
    expect(card).toBeTruthy();
    expect(card.querySelector('[data-summary-value="stats-views"]').textContent).toBe('12,5K');
    expect(card.querySelector('[data-summary-value="stats-likes"]').textContent).toBe('320');
    expect(card.querySelector('[data-summary-value="stats-comments"]').textContent).toBe('18');
  });
});

describe('updateVideoStatsCardDOM', () => {
  beforeEach(() => {
    renderIntoDom({ views: 0, likes: 0, comments: 0 });
  });

  it('haengt die Karte nach wenn spaeter Zahlen kommen', () => {
    expect(document.querySelector('[data-summary-card="video-stats"]')).toBeNull();
    updateVideoStatsCardDOM({ views: 900, likes: 40, comments: 2 });
    const card = document.querySelector('[data-summary-card="video-stats"]');
    expect(card).toBeTruthy();
    expect(card.querySelector('[data-summary-value="stats-views"]').textContent).toBe('900');
  });

  it('nimmt die Karte wieder raus wenn die Zahlen weg sind', () => {
    updateVideoStatsCardDOM({ views: 900, likes: 40, comments: 2 });
    expect(document.querySelector('[data-summary-card="video-stats"]')).toBeTruthy();
    updateVideoStatsCardDOM({ views: 0, likes: 0, comments: 0 });
    expect(document.querySelector('[data-summary-card="video-stats"]')).toBeNull();
  });
});

describe('UGC Budget-Kacheln', () => {
  const ugcKampagneData = {
    auftrag: { id: 'a1', nettobetrag: 10000, creator_budget: 8000 },
    auftragDetails: { campaign_type: ['ugc_paid'] }
  };
  const kooperationen = [{ id: 'k1', verkaufspreis_zusatzkosten: 0 }];
  const videos = [{ kooperation_id: 'k1', einkaufspreis_netto: 1000, verkaufspreis_netto: 2000 }];

  beforeEach(() => {
    window.canSeePricing = () => true;
    window.validatorSystem = { sanitizeHtml: (v) => v || '' };
  });

  it('zeigt UGC-Labels und Rest aus der Overview statt creator_budget − VK', () => {
    const html = renderSummaryCards(
      ugcKampagneData, 2000, 1, 1, 0, 0, null, 0,
      { kooperationen, videos, isKunde: false }
    );

    expect(html).toContain('Auftragsvolumen');
    expect(html).toContain('Verbrauchtes Budget');
    expect(html).toContain('Verfügbares Budget');
    expect(html).toContain('Zusatzkosten');
    expect(html).not.toContain('Creatorbudget');
    expect(html).not.toContain('Offenes Creator Budget');
    expect(html).not.toContain('Extra Kosten');
    // Formel-Tooltips auf den UGC-Kacheln
    expect(html).toContain('card-hint');
    expect(html).toContain('Nettobetrag des Auftrags');
    expect(html).toContain('Creatoranteil + Agenturanteil + KSK + Zusatzkosten');
    expect(html).toContain('Auftragsvolumen − Zusatzleistungen − Verbrauchtes Budget');
  });

  it('rechnet UGC-Rest wie Auftragsdetails (netto − EK − Fee − KSK − Extra)', () => {
    const html = renderSummaryCards(
      ugcKampagneData, 2000, 1, 1, 0, 0, null, 0,
      { kooperationen, videos, isKunde: false }
    );

    // EK 1000 + Marge 1000 + KSK 49 = 2049 verbraucht, Rest 7951
    expect(html).toContain('2.049,00');
    expect(html).toContain('7.951,00');
  });

  it('zeigt Kunde keine Creator-Anteil/Agenturanteil/KSK', () => {
    window.canSeePricing = () => false;
    const html = renderSummaryCards(
      ugcKampagneData, 2000, 1, 1, 0, 0, null, 0,
      { kooperationen, videos, isKunde: true }
    );

    expect(html).toContain('Auftragsvolumen');
    expect(html).toContain('Verfügbares Budget');
    expect(html).not.toContain('Creator-Anteil');
    expect(html).not.toContain('Agenturanteil');
    expect(html).not.toContain('>KSK<');
  });

  it('Influencer bleibt bei creator_budget − VK und alten Labels', () => {
    const html = renderSummaryCards(
      {
        auftrag: { id: 'a1', nettobetrag: 50000, creator_budget: 44000 },
        auftragDetails: { campaign_type: ['influencer'] }
      },
      3000, 1, 1, 0, 0, null, 0,
      { kooperationen, videos, isKunde: false }
    );

    expect(html).toContain('Creatorbudget');
    expect(html).toContain('Verbrauchtes Creatorbudget');
    expect(html).toContain('Offenes Creator Budget');
    expect(html).toContain('44.000,00');
    expect(html).toContain('41.000,00');
    // Influencer-Pfad in Kampagne bleibt ohne Info-Tooltips
    expect(html).not.toContain('card-hint');
  });

  it('Mixed ugc+influencer bleibt Influencer-Kacheln', () => {
    const html = renderSummaryCards(
      {
        auftrag: { id: 'a1', nettobetrag: 50000, creator_budget: 44000 },
        auftragDetails: { campaign_type: ['ugc_paid', 'influencer'] }
      },
      3000, 1, 1, 0, 0, null, 0,
      { kooperationen, videos, isKunde: false }
    );

    expect(html).toContain('Creatorbudget');
    expect(html).toContain('Offenes Creator Budget');
  });

  it('UGC + Vor-Ort-Produktion bleibt UGC-Kacheln', () => {
    const html = renderSummaryCards(
      {
        auftrag: { id: 'a1', nettobetrag: 10000, creator_budget: 8000 },
        auftragDetails: { campaign_type: ['vorort_produktion', 'ugc_paid', 'ugc_organic'] }
      },
      2000, 1, 1, 0, 0, null, 0,
      { kooperationen, videos, isKunde: false }
    );

    expect(html).toContain('Verfügbares Budget');
    expect(html).not.toContain('Offenes Creator Budget');
  });

  it('updateSummaryCardsDOM schreibt UGC-Rest aus der Overview', () => {
    document.body.innerHTML = renderSummaryCards(
      ugcKampagneData, 2000, 1, 1, 0, 0, null, 0,
      { kooperationen, videos, isKunde: false }
    );

    updateSummaryCardsDOM(ugcKampagneData, 2000, 1, 1, 0, 0, 0, { kooperationen, videos });

    expect(document.querySelector('[data-summary-value="open-budget"]').textContent).toBe('7.951,00\u00A0€');
  });

  it('UGC-Karten rechnen mit dem Kampagnen-Volumen statt dem ganzen Auftrag', () => {
    const html = renderSummaryCards(
      {
        ...ugcKampagneData,
        volumen: 3000,
        creator_budget: 3000,
        videoanzahl: 3,
        creatoranzahl: 1
      },
      2000, 1, 1, 0, 0, null, 0,
      { kooperationen, videos, isKunde: false }
    );

    expect(html).toContain('3.000,00');
    expect(html).not.toContain('10.000,00');
    expect(html).toContain('1 von 1');
    expect(html).toContain('1 von 3');
  });

  it('Influencer-Karten nutzen kampagne.creator_budget als Slice', () => {
    const html = renderSummaryCards(
      {
        auftrag: { id: 'a1', nettobetrag: 50000, creator_budget: 44000 },
        auftragDetails: { campaign_type: ['influencer'] },
        volumen: 20000,
        creator_budget: 15000
      },
      3000, 1, 1, 0, 0, null, 0,
      { kooperationen, videos, isKunde: false }
    );

    expect(html).toContain('15.000,00');
    expect(html).toContain('12.000,00');
    expect(html).not.toContain('44.000,00');
  });
});
