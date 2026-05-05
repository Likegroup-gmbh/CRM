// FeedbackPage.js - Feedback-Übersicht mit Kanban Board (Orchestrator)

import { FeedbackCreateDrawer } from './FeedbackCreateDrawer.js';
import {
  ICON_BUG, ICON_FEATURE, ICON_DONE, ICON_IN_PROGRESS,
  ICON_ADDITIONS, ICON_BACKLOG, FEEDBACK_AREAS
} from './FeedbackConstants.js';
import * as dataService from './FeedbackDataService.js';
import { renderColumn, renderFeedbackCardWrapper } from './FeedbackCardRenderer.js';
import {
  bindEvents, bindSingleCardEvents,
  isCommentsHidden, isMergedItemsExpanded
} from './FeedbackEventHandler.js';

export const feedbackPage = {
  feedbacks: [],
  childFeedbacks: {},
  comments: {},
  votes: {},
  creators: [],
  createDrawer: null,
  draggedFeedback: null,
  draggedElement: null,
  mergeTarget: null,
  mergeTimer: null,
  mergeZoneActive: false,
  isAdmin: false,
  editingCommentId: null,
  _abortController: null,
  _handleFeedbackCreated: null,
  filters: {
    priority: null,
    date: null,
    area: null,
    creator: null
  },

  async init() {
    console.log('💬 FeedbackPage: init()');

    window.setHeadline('Feedback');

    if (!window.isAdmin()) {
      const canView = window.currentUser?.permissions?.feedback?.can_view;
      if (!canView) {
        this.renderBlocked();
        return;
      }
    }

    this.isAdmin = window.isAdmin();
    this.createDrawer = new FeedbackCreateDrawer();

    await Promise.all([
      dataService.loadCreators(this),
      dataService.loadFeedbacks(this)
    ]);
    await Promise.all([
      dataService.loadComments(this),
      dataService.loadVotes(this)
    ]);

    this.render();
    this.bindEvents();
  },

  renderBlocked() {
    window.setContentSafely(window.content, `
      <div class="empty-state">
        <h2>Zugriff verweigert</h2>
        <p>Diese Seite ist nur für Mitarbeiter zugänglich.</p>
      </div>
    `);
  },

  async refresh() {
    await dataService.loadFeedbacks(this);
    await Promise.all([
      dataService.loadComments(this),
      dataService.loadVotes(this)
    ]);
    this.render();
    this.bindEvents();
  },

  render() {
    const closedFeedbacks = this.feedbacks
      .filter(f => f.status === 'closed')
      .sort((a, b) => (a.archived === b.archived) ? 0 : a.archived ? 1 : -1);

    const feedbackByColumn = {
      bug: this.feedbacks.filter(f => f.category === 'bug' && f.status === 'open'),
      feature: this.feedbacks.filter(f => f.category === 'feature' && f.status === 'open'),
      additions: this.feedbacks.filter(f => f.status === 'additions'),
      in_progress: this.feedbacks.filter(f => f.status === 'in_progress'),
      backlog: this.feedbacks.filter(f => f.status === 'backlog'),
      closed: closedFeedbacks
    };

    const areaOptionsHtml = FEEDBACK_AREAS
      .filter(a => a.value)
      .map(a => `<option value="${a.value}" ${this.filters.area === a.value ? 'selected' : ''}>${a.label}</option>`)
      .join('');

    const creatorOptionsHtml = this.creators
      .map(c => `<option value="${c.id}" ${this.filters.creator === c.id ? 'selected' : ''}>${c.name}</option>`)
      .join('');

    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <div class="filter-group">
            <input type="date" id="filter-date" class="form-input filter-select" value="${this.filters.date || ''}">
            <select id="filter-area" class="form-select filter-select">
              <option value="">Alle Bereiche</option>
              ${areaOptionsHtml}
            </select>
            <select id="filter-priority" class="form-select filter-select">
              <option value="">Alle Prioritäten</option>
              <option value="high" ${this.filters.priority === 'high' ? 'selected' : ''}>Hoch</option>
              <option value="medium" ${this.filters.priority === 'medium' ? 'selected' : ''}>Mittel</option>
              <option value="low" ${this.filters.priority === 'low' ? 'selected' : ''}>Niedrig</option>
            </select>
            <select id="filter-creator" class="form-select filter-select">
              <option value="">Alle Mitarbeiter</option>
              ${creatorOptionsHtml}
            </select>
          </div>
          <button class="primary-btn" id="new-feedback-btn">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Neues Feedback
          </button>
        </div>
      </div>

      <div class="content-section">
        <div class="kanban-board-wrapper">
          <div class="kanban-board kanban-board--6-cols">
            ${renderColumn(this, 'bug', 'Bugs', feedbackByColumn.bug, ICON_BUG)}
            ${renderColumn(this, 'feature', 'Features', feedbackByColumn.feature, ICON_FEATURE)}
            ${renderColumn(this, 'additions', 'Ergänzungen', feedbackByColumn.additions, ICON_ADDITIONS, true)}
            ${renderColumn(this, 'in_progress', 'In Bearbeitung', feedbackByColumn.in_progress, ICON_IN_PROGRESS, true)}
            ${renderColumn(this, 'closed', 'Erledigt', feedbackByColumn.closed, ICON_DONE, true)}
            ${renderColumn(this, 'backlog', 'Backlog/Hold', feedbackByColumn.backlog, ICON_BACKLOG, true)}
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  },

  bindEvents() {
    bindEvents(this);
  },

  rerenderCard(feedbackId) {
    const wrapper = document.querySelector(`.feedback-card-wrapper[data-feedback-id="${feedbackId}"]`);
    if (!wrapper) return;
    const fb = this.feedbacks.find(f => f.id === feedbackId);
    if (!fb) return;
    wrapper.outerHTML = renderFeedbackCardWrapper(this, fb);
    bindSingleCardEvents(this, feedbackId);
  },

  isCommentsHidden(feedbackId) {
    return isCommentsHidden(feedbackId);
  },

  isMergedItemsExpanded(parentId) {
    return isMergedItemsExpanded(parentId);
  },

  destroy() {
    console.log('🗑️ FeedbackPage: destroy()');
    this._abortController?.abort();
    this._abortController = null;
    clearTimeout(this.mergeTimer);
    this.mergeTimer = null;
  }
};
