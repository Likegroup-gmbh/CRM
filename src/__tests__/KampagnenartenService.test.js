import { beforeEach, describe, expect, it } from 'vitest';
import { KampagnenartenService } from '../modules/auftrag/services/KampagnenartenService.js';

describe('KampagnenartenService', () => {
  let service;

  beforeEach(() => {
    service = new KampagnenartenService();
    document.body.innerHTML = '<div id="kampagnenart-sections-container"></div>';
  });

  it('zeigt Videoanzahl bei bestehenden Werten initial an', () => {
    service.renderDynamicSections(
      ['UGC Pro Paid'],
      { ugc_pro_paid_video_anzahl: 3 }
    );

    const toggle = document.getElementById('ugc_pro_paid_video_anzahl_enabled');
    const wrapper = document.querySelector('[data-video-anzahl-wrapper="ugc_pro_paid"]');
    const input = document.getElementById('ugc_pro_paid_video_anzahl');

    expect(toggle).not.toBeNull();
    expect(toggle.checked).toBe(true);
    expect(wrapper.style.display).toBe('');
    expect(input.value).toBe('3');
  });

  it('blendet Videoanzahl per Toggle ein und aus und leert den Wert bei off', () => {
    service.renderDynamicSections(['UGC Pro Paid'], {});

    const toggle = document.getElementById('ugc_pro_paid_video_anzahl_enabled');
    const wrapper = document.querySelector('[data-video-anzahl-wrapper="ugc_pro_paid"]');
    const input = document.getElementById('ugc_pro_paid_video_anzahl');

    expect(toggle.checked).toBe(false);
    expect(wrapper.style.display).toBe('none');

    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    expect(wrapper.style.display).toBe('');

    input.value = '7';
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));

    expect(wrapper.style.display).toBe('none');
    expect(input.value).toBe('');
  });
});
