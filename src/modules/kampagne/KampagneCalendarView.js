// KampagneCalendarView.js - Kalenderansicht für Kampagnen mit Sidebar
// Links "Heute | Woche | Monat" (kampagneCalendarSidebar.js), rechts das Kalendergitter (CalendarGrid).
// Events sind die Deadlines der Kampagnen; Ziehen auf einen anderen Tag verschiebt die Deadline.

import { KampagnePreviewDrawer } from './KampagnePreviewDrawer.js';
import { KampagneUtils } from './KampagneUtils.js';
import { shouldHideCompleted } from './kampagneListPrefs.js';
import { sidebarGroups, sidebarHtml } from './kampagneCalendarSidebar.js';
import { CalendarGrid } from '../../core/components/CalendarGrid.js';
import { parseDateOnly } from '../../core/calendarDates.js';
import { escapeHtml as esc } from '../../core/format.js';

const DEADLINE_TYPES = {
  start: { label: 'Start', color: 'var(--color-info)' },
  deadline_briefing: { label: 'Briefing', color: 'var(--color-accent)' },
  deadline_strategie: { label: 'Konzepte', color: 'var(--color-warning)' },
  deadline_skripte: { label: 'Skripte', color: 'var(--color-tertiary)' },
  deadline_creator_sourcing: { label: 'Castings', color: 'var(--color-primary)' },
  deadline_video_produktion: { label: 'Video Produktion', color: 'var(--color-success)' },
  deadline_post_produktion: { label: 'Post Produktion', color: 'var(--color-secondary)' }
};

function normalizeUuidList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value.replace(/[{}]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function orgBubbleHtml(kampagne) {
  const logoUrl = kampagne.marke?.logo_url || kampagne.unternehmen?.logo_url;
  const name = kampagne.marke?.markenname || kampagne.unternehmen?.firmenname;
  if (!logoUrl && !name) return '';
  if (logoUrl) return `<img class="sidebar-item-logo" src="${esc(logoUrl)}" alt="${esc(name || '')}" />`;
  return `<div class="sidebar-item-avatar">${esc((name || '?').substring(0, 2).toUpperCase())}</div>`;
}

export class KampagneCalendarView {
  constructor() {
    this.container = null;
    this.kampagnen = [];
    this.previewDrawer = null;
    this.grid = null;
    this.sidebarEl = null;
    this.currentSidebarTab = 'today'; // 'today', 'week', 'month'
    this.searchQuery = '';
    this.deadlineTypes = DEADLINE_TYPES;
  }

  async init(containerElement) {
    this.container = containerElement;
    this.previewDrawer = new KampagnePreviewDrawer();
    await this.loadKampagnen();
    this.render();
  }

  async loadKampagnen() {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar');
        this.kampagnen = [];
        return;
      }

      // Nutze zentralisierte Permission-Logik aus KampagneUtils
      const allowedIds = await KampagneUtils.loadAllowedKampagneIds();

      // null = keine Filterung (Admin/Kunde), [] = kein Zugriff
      if (allowedIds !== null && allowedIds.length === 0) {
        this.kampagnen = [];
        return;
      }

      let query = window.supabase
        .from('kampagne')
        .select(`
          id,
          kampagnenname,
          eigener_name,
          start,
          deadline_briefing,
          deadline_strategie,
          deadline_skripte,
          deadline_creator_sourcing,
          deadline_video_produktion,
          deadline_post_produktion,
          unternehmen:unternehmen_id(id, firmenname, logo_url),
          marke:marke_id(id, markenname, logo_url)
        `)
        .order('created_at', { ascending: false });

      if (allowedIds !== null && allowedIds.length > 0) {
        query = query.in('id', allowedIds);
      }

      if (shouldHideCompleted(this.searchQuery)) {
        const { data: completedIds, error: completedError } = await window.supabase
          .rpc('get_completed_kampagne_ids');
        if (completedError) throw completedError;
        const ids = normalizeUuidList(completedIds);
        if (ids.length > 0) {
          query = query.not('id', 'in', `(${ids.join(',')})`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      this.kampagnen = data || [];
    } catch (error) {
      console.error('❌ CALENDAR: Fehler beim Laden:', error);
      this.kampagnen = [];
    }
  }

  async reload() {
    await this.loadKampagnen();
    this.render();
  }

  async refresh() {
    await this.reload();
  }

  // Hide-Completed hängt an leerer Suche — bei Leer/Nicht-leer nachladen.
  async setSearchQuery(query) {
    const next = (query || '').trim().toLowerCase();
    const hideBefore = shouldHideCompleted(this.searchQuery);
    this.searchQuery = next;
    if (hideBefore !== shouldHideCompleted(this.searchQuery)) {
      await this.loadKampagnen();
    }
    this.render();
  }

  getFilteredKampagnen() {
    if (!this.searchQuery) return this.kampagnen;
    const q = this.searchQuery;
    return this.kampagnen.filter(k => {
      const name = (k.kampagnenname || '').toLowerCase();
      const eigenName = (k.eigener_name || '').toLowerCase();
      return name.includes(q) || eigenName.includes(q);
    });
  }

  /** Je Kampagne und gesetzter Deadline ein Event, nach Datum sortiert. */
  getKampagnenWithDeadlines() {
    const events = [];
    this.getFilteredKampagnen().forEach(kampagne => {
      Object.keys(this.deadlineTypes).forEach(field => {
        const date = parseDateOnly(kampagne[field]);
        if (!date) return;
        events.push({
          id: `${kampagne.id}:${field}`,
          kampagne,
          deadlineType: field,
          date,
          title: KampagneUtils.getDisplayName(kampagne),
          sub: this.deadlineTypes[field].label,
          leadHtml: orgBubbleHtml(kampagne),
          draggable: true
        });
      });
    });
    return events.sort((a, b) => a.date - b.date);
  }

  render() {
    if (!this.container) return;
    if (!this.grid?.container || !this.container.contains(this.grid.container)) this.mountShell();
    this.renderSidebar();
    this.grid.render();
  }

  /** Gerüst einmal aufbauen; danach rendern Seitenleiste und Gitter je für sich. */
  mountShell() {
    this.grid?.destroy();
    this.container.innerHTML = `
      <div class="calendar-view-container">
        <aside class="calendar-sidebar" data-kc-sidebar></aside>
        <main data-kc-grid></main>
      </div>`;
    this.sidebarEl = this.container.querySelector('[data-kc-sidebar]');
    this.sidebarEl.addEventListener('click', (e) => this.onSidebarClick(e));
    this.grid = new CalendarGrid(this.container.querySelector('[data-kc-grid]'), {
      view: 'week',
      getEvents: () => this.getKampagnenWithDeadlines(),
      onMove: (id, isoDate) => this.moveEvent(id, isoDate),
      onSelect: (id) => this.openEvent(id)
    });
  }

  renderSidebar() {
    if (!this.sidebarEl) return;
    const groups = sidebarGroups(this.getKampagnenWithDeadlines());
    this.sidebarEl.innerHTML = sidebarHtml(groups, this.currentSidebarTab);
  }

  onSidebarClick(e) {
    const tab = e.target.closest('.calendar-sidebar-tabs .tab-button');
    if (tab) {
      if (tab.dataset.tab !== this.currentSidebarTab) {
        this.currentSidebarTab = tab.dataset.tab;
        this.renderSidebar();
      }
      return;
    }
    const item = e.target.closest('.sidebar-item');
    if (item) this.openPreviewDrawer(item.dataset.kampagneId, item.dataset.deadlineType);
  }

  splitEventId(id) {
    const [kampagneId, deadlineType] = String(id).split(':');
    return { kampagneId, deadlineType };
  }

  openEvent(id) {
    const { kampagneId, deadlineType } = this.splitEventId(id);
    this.openPreviewDrawer(kampagneId, deadlineType);
  }

  openPreviewDrawer(kampagneId, deadlineType) {
    const kampagne = this.kampagnen.find(k => k.id === kampagneId);
    if (kampagne && this.previewDrawer) {
      this.previewDrawer.open(kampagne, deadlineType);
    }
  }

  async moveEvent(id, newDate) {
    const { kampagneId, deadlineType } = this.splitEventId(id);
    if (!this.deadlineTypes[deadlineType]) return;
    await this.updateDeadline(kampagneId, deadlineType, newDate);
  }

  async updateDeadline(kampagneId, deadlineType, newDate) {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar');
        return;
      }

      const { error } = await window.supabase
        .from('kampagne')
        .update({ [deadlineType]: newDate, updated_at: new Date().toISOString() })
        .eq('id', kampagneId);
      if (error) throw error;

      await this.refresh();

      window.dispatchEvent(new CustomEvent('kampagneUpdated', {
        detail: { kampagneId, field: deadlineType, newValue: newDate }
      }));
    } catch (error) {
      console.error('❌ CALENDAR: Fehler beim Aktualisieren der Deadline:', error);
    }
  }

  destroy() {
    this.grid?.destroy();
    this.grid = null;
    this.sidebarEl = null;
    this.container = null;
    this.kampagnen = [];
    if (this.previewDrawer) {
      this.previewDrawer.close();
      this.previewDrawer = null;
    }
  }
}
