import { PersonDetailBase } from '../admin/PersonDetailBase.js';
import { StrategiebriefingService } from './StrategiebriefingService.js';

export class KickOffDetail extends PersonDetailBase {
  _abortController = null;

  constructor() {
    super();
    this.kickoff = null;
    this.markenwerte = [];
    this.kickoffId = null;
    this._handleAction = this._handleAction.bind(this);
  }

  async init(id) {
    this.kickoffId = id;
    window.setHeadline('Strategiebriefing');

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

      if (this.kickoff && !StrategiebriefingService.isV2(this.kickoff)) {
        const { data: mw } = await window.supabase
          .from('marke_kickoff_markenwerte')
          .select('markenwert_id, markenwert:markenwert_id(id, name)')
          .eq('kickoff_id', this.kickoff.id);

        this.markenwerte = (mw || []).map(m => m.markenwert).filter(Boolean);
      }

      if (window.breadcrumbSystem) {
        const label = this.kickoff?.unternehmen?.firmenname || 'Strategiebriefing';
        window.breadcrumbSystem.updateDetailLabel(label);
      }
    } catch (e) {
      console.error('Fehler beim Laden des Strategiebriefings:', e);
      this.kickoff = null;
      this.markenwerte = [];
    }
  }

  _isKunde() {
    return window.isKunde();
  }

  render() {
    if (!this.kickoff) {
      window.setContentSafely(window.content, '<div class="error-message"><p>Strategiebriefing nicht gefunden.</p></div>');
      return;
    }

    const k = this.kickoff;
    const firmenname = k.unternehmen?.firmenname || 'Unbekannt';
    const markenname = k.marke?.markenname || '';
    const displayName = markenname ? `${firmenname} — ${markenname}` : firmenname;
    const typeLabel = StrategiebriefingService.getLabel(k.kampagnenart || k.kickoff_type);

    const person = {
      name: displayName,
      subtitle: typeLabel,
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

    let sidebarInfo;

    if (StrategiebriefingService.isV2(k)) {
      sidebarInfo = this.renderInfoItems([
        { label: 'Kampagnenart', rawHtml: `<span class="tag">${this.sanitize(typeLabel)}</span>` },
        { icon: 'building', label: 'Unternehmen', rawHtml: unternehmenLink || '-' },
        { icon: 'marke', label: 'Marke', rawHtml: markeLink || '-' },
        { icon: 'calendar', label: 'Erstellt am', value: this.formatDate(k.created_at) },
        { label: 'Zusammenfassung', value: k.kampagnen_zusammenfassung },
        ...(k.ziel_influencer ? [{ label: 'Ziel (Influencer)', value: k.ziel_influencer }] : []),
        ...(k.format_influencer ? [{ label: 'Format (Influencer)', value: k.format_influencer }] : []),
        ...(k.funnel ? [{ label: 'Funnel', value: k.funnel }] : []),
        ...(k.ziel_paid ? [{ label: 'Ziel (Paid)', value: k.ziel_paid }] : []),
        ...(k.ziel_organic ? [{ label: 'Ziel (Organic)', value: k.ziel_organic }] : []),
        ...(k.format_organic ? [{ label: 'Format (Organic)', value: k.format_organic }] : []),
        { label: 'Was wird beworben?', value: k.beworben_typ },
        { label: 'Beschreibung', value: k.beworben_beschreibung },
        { label: 'Plattformen', value: Array.isArray(k.plattformen) ? k.plattformen.join(', ') : k.plattformen },
        { label: 'Creator-Branche', value: k.creator_branche },
        { label: 'Drehort', value: k.drehort },
        { label: 'Rechtliches', value: k.rechtliches },
        { label: 'Erfolgskriterien', value: k.erfolgskriterien },
        { label: 'Learnings', value: k.learnings },
      ]);
    } else {
      const markenwerteHtml = this.markenwerte.length > 0
        ? this.markenwerte.map(m => `<span class="tag">${this.sanitize(m.name)}</span>`).join(' ')
        : '—';

      sidebarInfo = this.renderInfoItems([
        { label: 'Typ', rawHtml: `<span class="tag">${this.sanitize(typeLabel)}</span> <small class="text-muted">(Legacy)</small>` },
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
    }

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
      if (this.kickoff?.marke?.id) {
        window.navigateTo(`/marke/${this.kickoff.marke.id}`);
      } else if (this.kickoff?.unternehmen?.id) {
        window.navigateTo(`/unternehmen/${this.kickoff.unternehmen.id}`);
      }
    } else if (action === 'goto-unternehmen' && this.kickoff?.unternehmen?.id) {
      window.navigateTo(`/unternehmen/${this.kickoff.unternehmen.id}`);
    } else if (action === 'goto-marke' && this.kickoff?.marke?.id) {
      window.navigateTo(`/marke/${this.kickoff.marke.id}`);
    }
  }

  bindDetailEvents() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    document.addEventListener('click', this._handleAction, { signal });
  }

  destroy() {
    this._abortController?.abort();
    this._abortController = null;
    this.kickoff = null;
    this.markenwerte = [];
  }
}

export const kickOffDetail = new KickOffDetail();
