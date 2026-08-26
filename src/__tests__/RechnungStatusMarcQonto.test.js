import { describe, it, expect } from 'vitest';
import { ICON_DEFS } from '../core/icons/iconDefs.js';
import { iconRegistry } from '../core/actions/IconRegistry.js';
import { ActionBuilder } from '../core/actions/ActionBuilder.js';

describe('Rechnungsstatus Marc an Qonto gesendet', () => {
  it('hat building-library als Icon-Def', () => {
    expect(ICON_DEFS['building-library']).toBeTruthy();
    expect(ICON_DEFS['building-library'].viewBox).toBe('0 0 24 24');
  });

  it('mappt den Status auf das Bank-Icon', () => {
    const html = iconRegistry.getStatusIcon('Marc an Qonto gesendet');
    expect(html).toContain('#crm-icon-building-library');
  });

  it('rendert den Status mit Icon im Aktionsmenü', () => {
    window.currentUser = { rolle: 'admin' };
    const html = new ActionBuilder().create('rechnung', 'r1', window.currentUser, {
      statusOptions: [
        { id: 'Offen', name: 'Offen' },
        { id: 'An Qonto gesendet', name: 'An Qonto gesendet' },
        { id: 'Marc an Qonto gesendet', name: 'Marc an Qonto gesendet' }
      ],
      currentStatus: { id: 'Offen', name: 'Offen' }
    });

    expect(html).toContain('data-status-name="Marc an Qonto gesendet"');
    expect(html).toContain('data-value="Marc an Qonto gesendet"');
    expect(html).toContain('#crm-icon-building-library');
    expect(html).toContain('#crm-icon-paper-airplane');
  });
});
