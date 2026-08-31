// ChatPanelShell.test.js
// Generische Chat-Shell: zwei Placements (header|fab), Groesse expanded|compact,
// Persistenz getrennt (offen/size), Activity-Dot nur bei geschlossenem Panel.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatPanelShell } from '../core/chat/ChatPanelShell.js';
import { HEADER_CHAT_BTN_ID } from '../core/chat/HeaderChatSlot.js';

function setupHeader() {
  const header = document.createElement('div');
  header.className = 'header-actions';
  header.innerHTML = '<button class="logout-btn"></button><div class="profile-menu"></div>';
  document.body.appendChild(header);
  return header;
}

describe('ChatPanelShell (Trigger: header)', () => {
  let shell;
  let header;

  beforeEach(() => {
    localStorage.clear();
    header = setupHeader();
  });

  afterEach(() => {
    shell?.destroy();
    shell = null;
    document.getElementById(HEADER_CHAT_BTN_ID)?.remove();
    header.remove();
    localStorage.clear();
  });

  it('registriert den Header-Button vor Logout; Klick oeffnet expanded, erneuter Klick schliesst', () => {
    shell = new ChatPanelShell().mount({
      trigger: 'header',
      persistKey: 't-chat',
      titleHtml: '<span>Liky</span>',
      bodyHtml: '<div id="t-log"></div>'
    });

    const btn = document.getElementById(HEADER_CHAT_BTN_ID);
    expect(btn).not.toBeNull();
    expect(btn.hidden).toBe(false);
    const kids = [...header.children];
    expect(kids.indexOf(btn)).toBeLessThan(kids.indexOf(header.querySelector('.logout-btn')));

    const panel = shell.panel;
    expect(panel.hidden).toBe(true);

    btn.click();
    expect(shell.isOpen()).toBe(true);
    expect(panel.hidden).toBe(false);
    expect(panel.classList.contains('is-expanded')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.classList.contains('is-offen')).toBe(true);

    btn.click();
    expect(shell.isOpen()).toBe(false);
    expect(panel.hidden).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.classList.contains('is-offen')).toBe(false);
  });

  it('Size-Button wechselt expanded <-> compact und persistiert die Groesse', () => {
    shell = new ChatPanelShell().mount({ trigger: 'header', persistKey: 't-chat' });
    shell.open();
    const sizeBtn = shell.panel.querySelector('.chat-panel__size-btn');

    sizeBtn.click();
    expect(shell.getSize()).toBe('compact');
    expect(shell.panel.classList.contains('is-compact')).toBe(true);
    expect(localStorage.getItem('t-chat-size')).toBe('compact');

    sizeBtn.click();
    expect(shell.getSize()).toBe('expanded');
    expect(localStorage.getItem('t-chat-size')).toBe('expanded');
  });

  it('Header-Open erzwingt expanded, auch wenn compact gespeichert ist', () => {
    localStorage.setItem('t-chat-size', 'compact');
    shell = new ChatPanelShell().mount({ trigger: 'header', persistKey: 't-chat' });
    shell.open();
    expect(shell.getSize()).toBe('expanded');
  });

  it('Close-Button schliesst und persistiert offen=false', () => {
    shell = new ChatPanelShell().mount({ trigger: 'header', persistKey: 't-chat' });
    shell.open();
    shell.panel.querySelector('.chat-panel__close-btn').click();
    expect(shell.isOpen()).toBe(false);
    expect(localStorage.getItem('t-chat-offen')).toBe('false');
  });

  it('getStoredState liefert den gespeicherten Zustand fuer den Restore', () => {
    localStorage.setItem('t-chat-offen', 'true');
    localStorage.setItem('t-chat-size', 'compact');
    shell = new ChatPanelShell().mount({ trigger: 'header', persistKey: 't-chat' });

    const { offen, size } = shell.getStoredState();
    expect(offen).toBe(true);
    expect(size).toBe('compact');

    shell.open({ size, persist: false });
    expect(shell.isOpen()).toBe(true);
    expect(shell.getSize()).toBe('compact');
  });

  it('destroy versteckt den Header-Button und entfernt das Panel', () => {
    shell = new ChatPanelShell().mount({ trigger: 'header', persistKey: 't-chat' });
    shell.open();
    shell.destroy();
    expect(document.getElementById(HEADER_CHAT_BTN_ID).hidden).toBe(true);
    expect(document.querySelector('.chat-panel')).toBeNull();
    shell = null;
  });

  it('Activity-Dot am Header nur bei geschlossenem Panel sichtbar', () => {
    shell = new ChatPanelShell().mount({ trigger: 'header', persistKey: 't-chat' });
    const dot = document.getElementById(HEADER_CHAT_BTN_ID).querySelector('.header-chat-dot');

    shell.setDot(true);
    expect(dot.hidden).toBe(false);

    shell.open();
    expect(dot.hidden).toBe(true);

    shell.close();
    expect(dot.hidden).toBe(false);
  });

  it('ohne .header-actions im DOM bleibt die Shell trotzdem benutzbar', () => {
    header.remove();
    shell = new ChatPanelShell().mount({ trigger: 'header', persistKey: 't-chat' });
    expect(document.getElementById(HEADER_CHAT_BTN_ID)).toBeNull();
    shell.open();
    expect(shell.isOpen()).toBe(true);
    header = setupHeader();
  });
});

describe('ChatPanelShell (Trigger: fab)', () => {
  let shell;

  beforeEach(() => localStorage.clear());

  afterEach(() => {
    shell?.destroy();
    shell = null;
    localStorage.clear();
  });

  it('FAB oeffnet compact, erneuter Klick schliesst; kein Header-Button noetig', () => {
    shell = new ChatPanelShell().mount({
      trigger: 'fab',
      persistKey: 't-fab',
      fabHtml: '<span>L</span>'
    });

    const fab = shell._root.querySelector('.chat-panel__fab');
    expect(fab).not.toBeNull();
    expect(document.getElementById(HEADER_CHAT_BTN_ID)).toBeNull();

    fab.click();
    expect(shell.isOpen()).toBe(true);
    expect(shell.getSize()).toBe('compact');
    expect(shell.panel.classList.contains('is-compact')).toBe(true);

    fab.click();
    expect(shell.isOpen()).toBe(false);
  });

  it('Expand aus compact wechselt in den Drawer-Modus', () => {
    shell = new ChatPanelShell().mount({ trigger: 'fab', persistKey: 't-fab' });
    shell.open();
    shell.panel.querySelector('.chat-panel__size-btn').click();
    expect(shell.getSize()).toBe('expanded');
    expect(shell.panel.classList.contains('is-expanded')).toBe(true);
  });
});
