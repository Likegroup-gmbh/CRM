import { PersonDetailBase } from '../admin/PersonDetailBase.js';

export class KickOffDetail extends PersonDetailBase {
  constructor() {
    super();
    this.kickoff = null;
    this.markenwerte = [];
    this.kickoffId = null;
    this._handleAction = this._handleAction.bind(this);
  }

  async init(id) {
    this.kickoffId = id;
    window.setHeadline('Kick-Off');

    await this.loadData();
    this.render();
    this.bindDetailEvents();
  }

  async loadData() {
    try {
      const { data, error } = await window.supabase
        .from('marke_kickoff')
        .select('*, unternehmen:unternehmen_id(id, firmenname), marke:marke_id(id, markenname)')
        .eq('id', this.kickoffId)
        .single();

      if (error) throw error;
      this.kickoff = data;

      if (this.kickoff) {
        const { data: mw } = await window.supabase
          .from('marke_kickoff_markenwerte')
          .select('markenwert_id, markenwert:markenwert_id(id, name)')
          .eq('kickoff_id', this.kickoff.id);

        this.markenwerte = (mw || []).map(m => m.markenwert).filter(Boolean);
      }

      if (window.breadcrumbSystem) {
        const label = this.kickoff?.unternehmen?.firmenname || 'Kick-Off';
        window.breadcrumbSystem.updateDetailLabel(label);
      }
    } catch (e) {
      console.error('Fehler beim Laden des Kick-Offs:', e);
      this.kickoff = null;
      this.markenwerte = [];
    }
  }

  _isKunde() {
    const rolle = window.currentUser?.rolle;
    return rolle === 'kunde' || rolle === 'kunde_editor';
  }

  render() {
    if (!this.kickoff) {
      window.setContentSafely(window.content, '<div class="error-message"><p>Kick-Off nicht gefunden.</p></div>');
      return;
    }

    const k = this.kickoff;
    const firmenname = k.unternehmen?.firmenname || 'Unbekannt';
    const markenname = k.marke?.markenname || '';
    const displayName = markenname ? `${firmenname} — ${markenname}` : firmenname;

    const person = {
      name: displayName,
      subtitle: k.kickoff_type === 'paid' ? 'Paid' : 'Organic',
      avatarOnly: false,
    };

    const quickActions = [];

    const isKunde = this._isKunde();
    const unternehmenLink = k.unternehmen?.id
      ? (isKunde
          ? this.sanitize(k.unternehmen.firmenname)
          : `<a href="/unternehmen/${k.unternehmen.id}" onclick="event.preventDefault(); window.navigateTo('/unternehmen/${k.unternehmen.id}')">${this.sanitize(k.unternehmen.firmenname)}</a>`)
      : null;
    const markeLink = k.marke?.id
      ? (isKunde
          ? this.sanitize(k.marke.markenname)
          : `<a href="/marke/${k.marke.id}" onclick="event.preventDefault(); window.navigateTo('/marke/${k.marke.id}')">${this.sanitize(k.marke.markenname)}</a>`)
      : null;

    const markenwerteHtml = this.markenwerte.length > 0
      ? this.markenwerte.map(m => `<span class="tag">${this.sanitize(m.name)}</span>`).join(' ')
      : '—';

    const sidebarInfo = this.renderInfoItems([
      { label: 'Typ', rawHtml: `<span class="tag">${this.sanitize(k.kickoff_type === 'paid' ? 'Paid' : 'Organic')}</span>` },
      { icon: 'building', label: 'Unternehmen', rawHtml: unternehmenLink || '-' },
      { icon: 'marke', label: 'Marke', rawHtml: markeLink || '-' },
      { icon: 'calendar', label: 'Erstellt am', value: this.formatDate(k.created_at) },
      { label: 'Brand-Essenz', value: k.brand_essenz },
      { label: 'Mission', value: k.mission },
      { label: 'Zielgruppe', value: k.zielgruppe },
      { label: 'Mindset der Zielgruppe', value: k.zielgruppen_mindset },
      { label: 'USP', value: k.marken_usp },
      { label: 'Tonalität & Sprachstil', value: k.tonalitaet_sprachstil },
      { label: 'Look & Feel', value: k.content_charakter },
      { label: 'Dos & Donts', value: k.dos_donts },
      { label: 'Rechtliche Leitplanken', value: k.rechtliche_leitplanken },
      { label: 'Markenwerte', rawHtml: markenwerteHtml },
    ]);

    const html = this.renderTwoColumnLayout({
      person,
      quickActions,
      sidebarInfo,
      tabNavigation: ' ',
      mainContent: '',
    });

    window.setContentSafely(window.content, html);
  }

  _handleAction(e) {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    if (action === 'edit-kickoff') {
      window.navigateTo('/kickoff-create');
    } else if (action === 'goto-unternehmen' && this.kickoff?.unternehmen?.id) {
      window.navigateTo(`/unternehmen/${this.kickoff.unternehmen.id}`);
    } else if (action === 'goto-marke' && this.kickoff?.marke?.id) {
      window.navigateTo(`/marke/${this.kickoff.marke.id}`);
    }
  }

  bindDetailEvents() {
    document.addEventListener('click', this._handleAction);
  }

  destroy() {
    document.removeEventListener('click', this._handleAction);
    this.kickoff = null;
    this.markenwerte = [];
  }
}

export const kickOffDetail = new KickOffDetail();
