import { beforeEach, describe, expect, it } from 'vitest';
import {
  hasVideoStats,
  renderSummaryCards,
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
