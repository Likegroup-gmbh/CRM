import { describe, it, expect, vi, afterEach } from 'vitest';
import { SplitButton } from '../core/components/SplitButton.js';
import { SplitButtonConfig, SplitButtonConfigs } from '../core/components/SplitButtonConfig.js';

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('SplitButton', () => {
  let btn;

  afterEach(() => {
    btn?.destroy();
    btn = null;
    document.body.innerHTML = '';
    delete SplitButtonConfigs['test-export'];
  });

  it('rendert Main, Toggle, Divider und Menu-Items aus der Config', () => {
    btn = new SplitButton();
    const html = btn.render('ugc-contract-submit', {
      buttonId: 'btn-submit',
      label: 'Erstellen & PDF',
      selectedId: 'legacy-de'
    });

    expect(html).toContain('data-split-config="ugc-contract-submit"');
    expect(html).toContain('data-split-primary');
    expect(html).toContain('data-split-toggle');
    expect(html).toContain('split-btn__divider');
    expect(html).toContain('id="btn-submit"');
    expect(html).toContain('Erstellen &amp; PDF');
    expect(html).toContain('Alter Vertrag (DE)');
    expect(html).toContain('Alter Vertrag (EN)');
    expect(html).toContain('Neuer Vertrag');
    expect(html).toContain('data-split-item="legacy-de"');
    expect(html).toContain('data-split-item="legacy-en"');
    expect(html).toContain('data-split-item="v2"');
    expect(html).toContain('data-split-item="draft"');
    expect(html).toContain('data-split-item="submit-and-new"');
    expect(html).toContain('Als Entwurf speichern');
    expect(html).toContain('Erstellen &amp; Neu mit gleichen Daten');
    expect(html).toContain('action-separator');
    expect(html).not.toContain('crm-icon-globe');
    expect(html).not.toContain('crm-icon-sparkles');
    expect(html).toContain('crm-icon-contract');
    expect(html).toContain('crm-icon-notebook');
    expect(html).toContain('crm-icon-document-refresh');
  });

  it('register legt eine neue Config an, analog ActionConfig', () => {
    SplitButtonConfig.register('test-export', {
      label: 'Export',
      variant: 'secondary',
      items: [
        { id: 'csv', icon: 'document', label: 'CSV', data: { format: 'csv' } },
        { id: 'pdf', icon: 'pdf', label: 'PDF', data: { format: 'pdf' } }
      ]
    });

    btn = new SplitButton();
    const html = btn.render('test-export');
    expect(html).toContain('split-btn--secondary');
    expect(html).toContain('CSV');
    expect(html).toContain('PDF');
    expect(html).toContain('data-format="csv"');
    expect(SplitButtonConfig.getItem('test-export', 'csv').data.format).toBe('csv');
  });

  it('items als Funktion werden mit options aufgerufen', () => {
    SplitButtonConfig.register('test-export', {
      label: 'Go',
      items: (opts) => [
        { id: 'a', label: opts.foo ? 'Ja' : 'Nein' }
      ]
    });
    btn = new SplitButton();
    expect(btn.render('test-export', { foo: true })).toContain('Ja');
    expect(btn.render('test-export', { foo: false })).toContain('Nein');
  });

  it('Toggle oeffnet ein Portal, Escape schliesst es', () => {
    btn = new SplitButton();
    btn.init();
    document.body.innerHTML = btn.render('ugc-contract-submit');

    click(document.querySelector('[data-split-toggle]'));
    expect(document.querySelector('.split-btn__menu-portal')).toBeTruthy();
    expect(document.querySelector('.split-btn').classList.contains('is-open')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.split-btn__menu-portal')).toBeNull();
  });

  it('Menue-Item feuert den Handler mit Config-Daten', () => {
    btn = new SplitButton();
    btn.init();
    const handler = vi.fn();
    btn.setHandler('ugc-contract-submit', handler);
    document.body.innerHTML = btn.render('ugc-contract-submit');

    click(document.querySelector('[data-split-toggle]'));
    click(document.querySelector('.split-btn__menu-portal [data-split-item="legacy-en"]'));

    expect(handler).toHaveBeenCalledTimes(1);
    const [item] = handler.mock.calls[0];
    expect(item.id).toBe('legacy-en');
    expect(item.data).toEqual({ template: 'legacy', lang: 'en' });
    expect(document.querySelector('.split-btn__menu-portal')).toBeNull();
  });

  it('Primary-Klick nutzt die aktuell selektierte Variante', () => {
    btn = new SplitButton();
    btn.init();
    const handler = vi.fn();
    btn.setHandler('ugc-contract-submit', handler);
    document.body.innerHTML = btn.render('ugc-contract-submit', { selectedId: 'v2' });

    click(document.querySelector('[data-split-primary]'));
    const [item] = handler.mock.calls[0];
    expect(item.id).toBe('v2');
    expect(item.data.template).toBe('v2');
  });

  it('Portal bleibt im Viewport wenn der Button links sitzt', () => {
    btn = new SplitButton();
    btn.init();
    document.body.innerHTML = `<div style="position:fixed;left:16px;top:16px">${btn.render('ugc-contract-submit')}</div>`;
    click(document.querySelector('[data-split-toggle]'));
    const portal = document.querySelector('.split-btn__menu-portal');
    expect(portal).toBeTruthy();
    expect(portal.getBoundingClientRect().left).toBeGreaterThanOrEqual(0);
  });

  it('selects:false: kein Check, data-split-selected bleibt, Handler bekommt das Item', () => {
    btn = new SplitButton();
    btn.init();
    const handler = vi.fn();
    btn.setHandler('ugc-contract-submit', handler);
    document.body.innerHTML = btn.render('ugc-contract-submit', { selectedId: 'legacy-de' });

    const root = document.querySelector('.split-btn');
    expect(root.dataset.splitSelected).toBe('legacy-de');

    click(document.querySelector('[data-split-toggle]'));
    const portal = document.querySelector('.split-btn__menu-portal');
    const draftItem = portal.querySelector('[data-split-item="draft"]');
    expect(draftItem).toBeTruthy();
    expect(draftItem.classList.contains('is-active')).toBe(false);
    expect(draftItem.querySelector('.submenu-check')).toBeNull();

    click(draftItem);
    expect(handler).toHaveBeenCalledTimes(1);
    const [item] = handler.mock.calls[0];
    expect(item.id).toBe('draft');
    expect(item.data.action).toBe('draft');
    expect(root.dataset.splitSelected).toBe('legacy-de');
    expect(document.querySelector('.split-btn__menu-portal')).toBeNull();
  });

  it('submit-and-new ist Kommando, keine Variante', () => {
    btn = new SplitButton();
    btn.init();
    const handler = vi.fn();
    btn.setHandler('ugc-contract-submit', handler);
    document.body.innerHTML = btn.render('ugc-contract-submit', { selectedId: 'legacy-en' });

    click(document.querySelector('[data-split-toggle]'));
    click(document.querySelector('.split-btn__menu-portal [data-split-item="submit-and-new"]'));

    const [item] = handler.mock.calls[0];
    expect(item.id).toBe('submit-and-new');
    expect(item.data.action).toBe('submit-and-new');
    expect(document.querySelector('.split-btn').dataset.splitSelected).toBe('legacy-en');
  });

  it('escapt Labels in der Ausgabe', () => {
    SplitButtonConfig.register('test-export', {
      label: '<b>X</b>',
      items: [{ id: 'a', label: '<script>' }]
    });
    btn = new SplitButton();
    const html = btn.render('test-export');
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('Configs fuer alle fuenf Vertragstypen existieren mit Draft + Submit-and-new', () => {
    const ids = [
      'ugc-contract-submit',
      'influencer-contract-submit',
      'videograph-contract-submit',
      'model-contract-submit',
      'contracting-contract-submit'
    ];
    for (const id of ids) {
      const config = SplitButtonConfig.get(id);
      expect(config, id).toBeTruthy();
      const items = SplitButtonConfig.resolveItems(config);
      const itemIds = items.map((i) => i.id);
      expect(itemIds).toContain('draft');
      expect(itemIds).toContain('submit-and-new');
      expect(itemIds).toContain('separator');
    }
    const ugc = SplitButtonConfig.resolveItems(SplitButtonConfig.get('ugc-contract-submit')).map((i) => i.id);
    expect(ugc).toEqual(['legacy-de', 'legacy-en', 'v2', 'separator', 'draft', 'submit-and-new']);
    const influencer = SplitButtonConfig.resolveItems(SplitButtonConfig.get('influencer-contract-submit')).map((i) => i.id);
    expect(influencer).toEqual(['legacy-de', 'legacy-en', 'awareness-de', 'awareness-en', 'separator', 'draft', 'submit-and-new']);
  });

  it('disabledItemIds markiert Items als action-disabled', () => {
    btn = new SplitButton();
    const html = btn.render('ugc-contract-submit', { disabledItemIds: ['legacy-de', 'submit-and-new'] });
    document.body.innerHTML = html;
    const legacyDe = document.querySelector('[data-split-item="legacy-de"]');
    const submitNew = document.querySelector('[data-split-item="submit-and-new"]');
    const draft = document.querySelector('[data-split-item="draft"]');
    expect(legacyDe.classList.contains('action-disabled')).toBe(true);
    expect(legacyDe.getAttribute('aria-disabled')).toBe('true');
    expect(submitNew.classList.contains('action-disabled')).toBe(true);
    expect(draft.classList.contains('action-disabled')).toBe(false);
  });

  it('setItemsDisabled toggelt Klassen ohne Re-Render, Klick auf disabled feuert nicht', () => {
    btn = new SplitButton();
    btn.init();
    const handler = vi.fn();
    btn.setHandler('ugc-contract-submit', handler);
    document.body.innerHTML = btn.render('ugc-contract-submit');
    const root = document.querySelector('.split-btn');

    btn.setItemsDisabled(root, ['legacy-de', 'legacy-en', 'v2', 'submit-and-new'], true);
    btn.setPrimaryDisabled(root, true);

    expect(document.querySelector('[data-split-primary]').disabled).toBe(true);
    expect(root.querySelector('[data-split-item="v2"]').classList.contains('action-disabled')).toBe(true);
    expect(root.querySelector('[data-split-item="draft"]').classList.contains('action-disabled')).toBe(false);

    click(document.querySelector('[data-split-toggle]'));
    click(document.querySelector('.split-btn__menu-portal [data-split-item="v2"]'));
    expect(handler).not.toHaveBeenCalled();
    btn.closeAll();

    click(document.querySelector('[data-split-toggle]'));
    click(document.querySelector('.split-btn__menu-portal [data-split-item="draft"]'));
    expect(handler).toHaveBeenCalledTimes(1);

    btn.setItemsDisabled(root, ['v2'], false);
    btn.setPrimaryDisabled(root, false);
    expect(root.querySelector('[data-split-item="v2"]').classList.contains('action-disabled')).toBe(false);
    expect(document.querySelector('[data-split-primary]').disabled).toBe(false);
  });
});
