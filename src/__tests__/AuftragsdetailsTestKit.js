import { beforeEach, vi } from 'vitest';

// Budget zählt nur Video-Zeilen: je Kooperation eine Video-Zeile mit ihren Preisen.
export function videosAusKoops(koops) {
  return koops.map(k => ({
    id: `v-${k.id}`,
    kooperation_id: k.id,
    einkaufspreis_netto: k.einkaufspreis_netto,
    verkaufspreis_netto: k.verkaufspreis_netto
  }));
}

export function setupAuftragsdetailsGlobals() {
  beforeEach(() => {
    vi.clearAllMocks();
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn();
    window.content = document.createElement('div');
    window.ErrorHandler = { handle: vi.fn() };
    window.canSeePricing = () => window.currentUser?.rolle !== 'kunde';
  });
}
