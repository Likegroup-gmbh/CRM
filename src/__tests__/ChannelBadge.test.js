import { afterEach, describe, expect, it, vi } from 'vitest';
import schalterDatei from '../core/parallelbetrieb/schalter.json';

async function laden(env) {
  vi.stubEnv('VITE_APP_CHANNEL', 'v2');
  vi.stubEnv('VITE_CHANNEL_BADGE', env);
  vi.resetModules();
  return import('../core/parallelbetrieb/ChannelBadge.js');
}

afterEach(() => {
  vi.unstubAllEnvs();
  document.body.innerHTML = '';
});

describe('ChannelBadge-Schalter', () => {
  it('ist in der Datei ausgeschaltet', () => {
    expect(schalterDatei.channelBadge).toBe(false);
  });

  it('Datei entscheidet, wenn die Env leer ist', async () => {
    const { channelBadgeAktiv } = await laden('');
    expect(channelBadgeAktiv('', { channelBadge: false })).toBe(false);
    expect(channelBadgeAktiv('', { channelBadge: true })).toBe(true);
  });

  it('Env übersteuert die Datei', async () => {
    const { channelBadgeAktiv } = await laden('');
    expect(channelBadgeAktiv('on', { channelBadge: false })).toBe(true);
    expect(channelBadgeAktiv('OFF', { channelBadge: true })).toBe(false);
  });

  it('rendert bei v2-Kanal und Schalter aus nichts', async () => {
    const { initChannelBadge } = await laden('');
    initChannelBadge();
    expect(document.querySelector('.channel-badge')).toBeNull();
  });

  it('rendert bei v2-Kanal und Schalter an das Badge', async () => {
    const { initChannelBadge } = await laden('on');
    initChannelBadge();
    expect(document.querySelector('.channel-badge')?.textContent).toBe('v2');
  });
});
