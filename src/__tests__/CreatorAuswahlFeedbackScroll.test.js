import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreatorAuswahlDetail } from '../modules/creator-auswahl/CreatorAuswahlDetail.js';
import { creatorAuswahlService } from '../modules/creator-auswahl/CreatorAuswahlService.js';

vi.mock('../modules/creator-auswahl/CreatorAuswahlService.js', () => ({
  creatorAuswahlService: { updateItem: vi.fn(async () => ({})) }
}));

describe('CreatorAuswahlDetail – Kundenfeedback haelt die Scrollposition', () => {
  let detail;

  beforeEach(() => {
    document.body.innerHTML = `
      <div class="main-wrapper">
        <div class="table-container"><table class="creator-pool-table"></table></div>
      </div>`;
    detail = new CreatorAuswahlDetail();
    detail.items = [{ id: '1', name: 'Anna', prio_1: false, prio_2: false, abgelehnt: false }];
    detail.activeTab = 'alle';
    detail.searchQuery = '';
    detail.statusFilter = [];
    detail.liste = { teilbereich: '' };
    detail.hiddenColumns = [];
    // Re-Render nicht wirklich ausfuehren - getestet wird der Scroll-Vertrag.
    vi.spyOn(detail, 'rerenderTable').mockImplementation(() => {});
    vi.spyOn(detail, 'bindEvents').mockImplementation(() => {});
    vi.stubGlobal('requestAnimationFrame', (cb) => { cb(); return 1; });
  });

  it('handleKundenFeedbackChange stellt window.scrollY nach dem Re-Render wieder her', async () => {
    window.scrollY = 900;
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    await detail.handleKundenFeedbackChange('1', 'prio_1');

    expect(detail.rerenderTable).toHaveBeenCalled();
    expect(scrollSpy).toHaveBeenCalledWith({ top: 900, behavior: 'instant' });
    expect(detail.items[0].prio_1).toBe(true);
    scrollSpy.mockRestore();
  });

  it('haelt den horizontalen Scroll des main-wrapper', async () => {
    const mainWrapper = document.querySelector('.main-wrapper');
    Object.defineProperty(mainWrapper, 'scrollLeft', { configurable: true, writable: true, value: 240 });
    window.scrollY = 0;
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    await detail.handleKundenFeedbackChange('1', 'abgelehnt');

    expect(mainWrapper.scrollLeft).toBe(240);
  });

  it('schreibt die Flags exklusiv (abgelehnt loescht prio)', async () => {
    detail.items[0].prio_1 = true;
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    await detail.handleKundenFeedbackChange('1', 'abgelehnt');

    expect(creatorAuswahlService.updateItem).toHaveBeenCalledWith('1',
      expect.objectContaining({ prio_1: false, prio_2: false, abgelehnt: true }));
  });
});
