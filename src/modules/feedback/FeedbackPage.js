// FeedbackPage.js - Feedback-Übersicht mit Kanban Board
import { FeedbackCreateDrawer } from './FeedbackCreateDrawer.js';

// Icons
const ICON_BUG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0 1 12 12.75Zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 0 1-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44.125 2.104.52 4.136 1.153 6.06M12 12.75a2.25 2.25 0 0 0 2.248-2.354M12 12.75a2.25 2.25 0 0 1-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 0 0-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.734 3.734 0 0 1 .4-2.253M12 8.25a2.25 2.25 0 0 0-2.248 2.146M12 8.25a2.25 2.25 0 0 1 2.248 2.146M8.683 5a6.032 6.032 0 0 1-1.155-1.002c.07-.63.27-1.222.574-1.747m.581 2.749A3.75 3.75 0 0 1 15.318 5m0 0c.427-.283.815-.62 1.155-.999a4.471 4.471 0 0 0-.575-1.752M4.921 6a24.048 24.048 0 0 0-.392 3.314c1.668.546 3.416.914 5.223 1.082M19.08 6c.205 1.08.337 2.187.392 3.314a23.882 23.882 0 0 1-5.223 1.082" /></svg>`;

const ICON_FEATURE = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>`;

const ICON_DONE = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>`;

const ICON_IN_PROGRESS = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" /></svg>`;

const ICON_ADDITIONS = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>`;

const ICON_BACKLOG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>`;

const ICON_ARCHIVE = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>`;

const ICON_UNARCHIVE = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125 2.25 2.25m0 0 2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>`;

const ICON_DELETE = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`;

const ICON_EDIT = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`;

const ICON_EDIT_SMALL = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="12" height="12"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`;

const ICON_DELETE_SMALL = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="12" height="12"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`;

const ICON_SEND = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>`;

const ICON_COMMENT = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>`;

const ICON_UPVOTE = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" /></svg>`;

const ICON_DOWNVOTE = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384m-10.253 1.5H9.7m8.075-9.75c.01.05.027.1.05.148.593 1.2.925 2.55.925 3.977 0 1.487-.36 2.89-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.306.774-1.086 1.227-1.918 1.227h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 0 0 .303-.54" /></svg>`;

export const feedbackPage = {
  feedbacks: [],
  comments: {}, // feedbackId -> comments[]
  votes: {}, // feedbackId -> { upvotes: number, downvotes: number, userVote: 'up'|'down'|null }
  createDrawer: null,
  draggedFeedback: null,
  isAdmin: false,
  editingCommentId: null, // ID des aktuell bearbeiteten Kommentars
  filters: {
    priority: null,
    date: null
  },

  async init() {
    console.log('💬 FeedbackPage: init()');
    
    // Headline & Breadcrumb
    window.setHeadline('Feedback');
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Feedback', url: '/feedback', clickable: false }
      ]);
    }
    
    // Berechtigungsprüfung (nutzt berechnete Permissions statt rohe zugriffsrechte)
    if (window.currentUser?.rolle !== 'admin') {
      const canView = window.currentUser?.permissions?.feedback?.can_view;
      if (!canView) {
        this.renderBlocked();
        return;
      }
    }
    
    this.isAdmin = window.currentUser?.rolle === 'admin';
    this.createDrawer = new FeedbackCreateDrawer();
    await this.loadFeedbacks();
    await this.loadComments();
    await this.loadVotes();
    this.render();
    this.bindEvents();
  },

  renderBlocked() {
    const html = `
      <div class="empty-state">
        <h2>Zugriff verweigert</h2>
        <p>Diese Seite ist nur für Mitarbeiter zugänglich.</p>
      </div>
    `;
    window.setContentSafely(window.content, html);
  },

  async loadFeedbacks() {
    if (!window.supabase) {
      this.feedbacks = [];
      return;
    }

    let query = window.supabase
      .from('feedback')
      .select(`
        *,
        creator:created_by(id, name)
      `)
      .order('created_at', { ascending: false });

    if (this.filters.priority) {
      query = query.eq('priority', this.filters.priority);
    }

    if (this.filters.date) {
      const startOfDay = `${this.filters.date}T00:00:00`;
      const endOfDay = `${this.filters.date}T23:59:59.999`;
      query = query.gte('created_at', startOfDay).lte('created_at', endOfDay);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Fehler beim Laden der Feedbacks:', error);
      this.feedbacks = [];
    } else {
      this.feedbacks = data || [];
    }
  },

  async loadComments() {
    if (!window.supabase || this.feedbacks.length === 0) {
      this.comments = {};
      return;
    }

    const feedbackIds = this.feedbacks.map(f => f.id);
    
    const { data, error } = await window.supabase
      .from('feedback_comments')
      .select(`
        *,
        author:author_id(id, name)
      `)
      .in('feedback_id', feedbackIds)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Fehler beim Laden der Kommentare:', error);
      this.comments = {};
      return;
    }

    // Gruppiere nach feedback_id
    this.comments = {};
    (data || []).forEach(comment => {
      if (!this.comments[comment.feedback_id]) {
        this.comments[comment.feedback_id] = [];
      }
      this.comments[comment.feedback_id].push(comment);
    });
  },

  async loadVotes() {
    if (!window.supabase || this.feedbacks.length === 0) {
      this.votes = {};
      return;
    }

    const feedbackIds = this.feedbacks.map(f => f.id);
    const currentUserId = window.currentUser?.id;
    
    const { data, error } = await window.supabase
      .from('feedback_votes')
      .select('*')
      .in('feedback_id', feedbackIds);

    if (error) {
      console.error('Fehler beim Laden der Votes:', error);
      this.votes = {};
      return;
    }

    // Gruppiere und zähle Votes
    this.votes = {};
    feedbackIds.forEach(id => {
      this.votes[id] = { upvotes: 0, downvotes: 0, userVote: null };
    });

    (data || []).forEach(vote => {
      if (!this.votes[vote.feedback_id]) {
        this.votes[vote.feedback_id] = { upvotes: 0, downvotes: 0, userVote: null };
      }
      if (vote.vote_type === 'up') {
        this.votes[vote.feedback_id].upvotes++;
      } else if (vote.vote_type === 'down') {
        this.votes[vote.feedback_id].downvotes++;
      }
      // Merke den Vote des aktuellen Users
      if (vote.user_id === currentUserId) {
        this.votes[vote.feedback_id].userVote = vote.vote_type;
      }
    });
  },

  render() {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;

    // Gruppiere nach Kategorie/Status
    // Sortiere closed: nicht-archivierte zuerst, archivierte am Ende
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

    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <div class="filter-group">
            <input type="date" id="filter-date" class="form-input filter-select" value="${this.filters.date || ''}">
            <select id="filter-priority" class="form-select filter-select">
              <option value="">Alle Prioritäten</option>
              <option value="high" ${this.filters.priority === 'high' ? 'selected' : ''}>Hoch</option>
              <option value="medium" ${this.filters.priority === 'medium' ? 'selected' : ''}>Mittel</option>
              <option value="low" ${this.filters.priority === 'low' ? 'selected' : ''}>Niedrig</option>
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
            ${this.renderColumn('bug', 'Bugs', feedbackByColumn.bug, ICON_BUG)}
            ${this.renderColumn('feature', 'Features', feedbackByColumn.feature, ICON_FEATURE)}
            ${this.renderColumn('additions', 'Ergänzungen', feedbackByColumn.additions, ICON_ADDITIONS, true)}
            ${this.renderColumn('in_progress', 'In Bearbeitung', feedbackByColumn.in_progress, ICON_IN_PROGRESS, true)}
            ${this.renderColumn('closed', 'Erledigt', feedbackByColumn.closed, ICON_DONE, true)}
            ${this.renderColumn('backlog', 'Backlog/Hold', feedbackByColumn.backlog, ICON_BACKLOG, true)}
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  },

  renderColumn(columnId, title, feedbacks, icon = '', isStatusColumn = false) {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    const showAddButton = !isStatusColumn; // Keine Add-Buttons für Status-Spalten

    return `
      <div class="kanban-column" data-column="${columnId}">
        <div class="kanban-column-header">
          <div class="kanban-column-header-left">
            <span class="kanban-column-title">${icon} ${safe(title)}</span>
            <span class="kanban-count">${feedbacks.length}</span>
          </div>
          ${showAddButton ? `
            <button class="btn-add-feedback-in-column" data-category="${columnId}" title="Feedback hinzufügen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          ` : ''}
        </div>
        <div class="kanban-column-body" data-column="${columnId}">
          ${feedbacks.length === 0 ? `
            <div class="kanban-empty-state">
              <p>Keine Einträge</p>
            </div>
          ` : feedbacks.map(fb => this.renderFeedbackCardWrapper(fb)).join('')}
        </div>
      </div>
    `;
  },

  renderFeedbackCardWrapper(fb) {
    const feedbackComments = this.comments[fb.id] || [];
    const hasComments = feedbackComments.length > 0;
    
    // Admin kann immer kommentieren, Mitarbeiter nur wenn bereits Kommentare existieren
    const canComment = this.isAdmin || hasComments;

    const isArchived = fb.archived === true;
    const wrapperArchivedClass = isArchived ? 'feedback-card-wrapper--archived' : '';

    return `
      <div class="feedback-card-wrapper ${wrapperArchivedClass}" data-feedback-id="${fb.id}">
        ${this.renderFeedbackCard(fb, feedbackComments)}
        ${this.renderCommentsSection(fb.id, feedbackComments, canComment)}
      </div>
    `;
  },

  renderFeedbackCard(fb, feedbackComments = []) {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    
    const priorityClass = {
      low: 'priority-low',
      medium: 'priority-medium',
      high: 'priority-high'
    }[fb.priority] || 'priority-medium';

    const priorityLabel = {
      low: 'Niedrig',
      medium: 'Mittel',
      high: 'Hoch'
    }[fb.priority] || 'Mittel';

    const formattedDate = new Date(fb.created_at).toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    });

    // Nur der Ersteller darf bearbeiten/löschen
    const canEdit = fb.created_by === window.currentUser?.id;
    const canDelete = fb.created_by === window.currentUser?.id;
    const commentCount = feedbackComments.length;
    
    // Vote-Daten (nur für Features)
    const isFeature = fb.category === 'feature';
    const voteData = this.votes[fb.id] || { upvotes: 0, downvotes: 0, userVote: null };
    const hasUpvoted = voteData.userVote === 'up';
    const hasDownvoted = voteData.userVote === 'down';

    // Effort Labels
    const effortLabels = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch' };
    const effortLabel = fb.effort ? effortLabels[fb.effort] : null;

    // Archive Status
    const isArchived = fb.archived === true;
    const archivedClass = isArchived ? 'feedback-card--archived' : '';
    const canArchive = this.isAdmin && fb.status === 'closed';

    return `
      <div class="task-card feedback-card ${priorityClass} ${archivedClass}" 
           draggable="${this.isAdmin ? 'true' : 'false'}" 
           data-feedback-id="${fb.id}"
           data-category="${fb.category}"
           data-status="${fb.status}"
           data-archived="${isArchived}">
        
        <div class="task-card-header">
          <div class="task-priority-badge">
            <span class="task-priority-indicator"></span>
            <span class="task-priority-text">${priorityLabel}</span>
          </div>
          <div class="feedback-card-actions">
            ${this.isAdmin ? `
              <select class="feedback-card-effort-select" data-feedback-id="${fb.id}">
                <option value="">Aufwand</option>
                <option value="low" ${fb.effort === 'low' ? 'selected' : ''}>Niedrig</option>
                <option value="medium" ${fb.effort === 'medium' ? 'selected' : ''}>Mittel</option>
                <option value="high" ${fb.effort === 'high' ? 'selected' : ''}>Hoch</option>
              </select>
            ` : (effortLabel ? `
              <span class="feedback-card-effort-badge effort-${fb.effort}">${effortLabel}</span>
            ` : '')}
            ${canEdit ? `
              <button class="btn-edit-feedback" data-feedback-id="${fb.id}" title="Feedback bearbeiten">
                ${ICON_EDIT}
              </button>
            ` : ''}
            ${canDelete ? `
              <button class="btn-delete-feedback" data-feedback-id="${fb.id}" title="Feedback löschen">
                ${ICON_DELETE}
              </button>
            ` : ''}
            ${canArchive ? `
              <button class="btn-archive-feedback ${isArchived ? 'active' : ''}" data-feedback-id="${fb.id}" title="${isArchived ? 'Archivierung aufheben' : 'Archivieren'}">
                ${isArchived ? ICON_UNARCHIVE : ICON_ARCHIVE}
              </button>
            ` : ''}
          </div>
        </div>

        <div class="task-card-body">
          <p class="feedback-description">${safe(fb.description)}</p>
        </div>

        <div class="task-card-footer">
          <div class="task-meta-left">
            <span class="feedback-date">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              ${formattedDate}
            </span>
            ${commentCount > 0 ? `
              <span class="feedback-comment-indicator" title="${commentCount} Kommentar${commentCount > 1 ? 'e' : ''}">
                ${ICON_COMMENT}
                <span class="comment-count">${commentCount}</span>
              </span>
            ` : ''}
            ${isFeature ? `
              <div class="feedback-vote-buttons">
                <button class="btn-vote btn-upvote ${hasUpvoted ? 'active' : ''}" 
                        data-feedback-id="${fb.id}" 
                        data-vote-type="up" 
                        title="Upvote">
                  ${ICON_UPVOTE}
                  <span class="vote-count">${voteData.upvotes}</span>
                </button>
                <button class="btn-vote btn-downvote ${hasDownvoted ? 'active' : ''}" 
                        data-feedback-id="${fb.id}" 
                        data-vote-type="down" 
                        title="Downvote">
                  ${ICON_DOWNVOTE}
                  <span class="vote-count">${voteData.downvotes}</span>
                </button>
              </div>
            ` : ''}
          </div>
          <div class="task-meta-right">
            <span class="feedback-creator">${safe(fb.creator?.name || 'Unbekannt')}</span>
          </div>
        </div>
      </div>
    `;
  },

  renderCommentsSection(feedbackId, comments, canComment) {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    
    // Hilfsfunktion für Initialen
    const getInitials = (name) => {
      if (!name) return '?';
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    };

    const commentsHtml = comments.map(c => {
      const date = new Date(c.created_at).toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric'
      });
      
      // Nur der Autor kann bearbeiten
      const canEditComment = c.author_id === window.currentUser?.id;
      const isEditing = this.editingCommentId === c.id;
      const authorName = c.author?.name || 'Unbekannt';
      const initials = getInitials(authorName);
      
      if (isEditing) {
        // Edit-Modus: Textarea anzeigen
        return `
          <div class="feedback-comment feedback-comment--editing" data-comment-id="${c.id}">
            <div class="comment-header">
              <div class="avatar-bubble avatar-bubble--comment" title="${safe(authorName)}">${initials}</div>
              <span class="comment-meta">${safe(authorName)} • ${date}</span>
            </div>
            <div class="comment-edit-form">
              <textarea class="comment-edit-input" 
                        data-comment-id="${c.id}"
                        data-feedback-id="${feedbackId}"
                        rows="1">${safe(c.text)}</textarea>
              <div class="comment-edit-actions">
                <button class="btn-cancel-edit" data-comment-id="${c.id}" data-feedback-id="${feedbackId}">Abbrechen</button>
                <button class="btn-save-edit" data-comment-id="${c.id}" data-feedback-id="${feedbackId}">Speichern</button>
              </div>
            </div>
          </div>
        `;
      }
      
      return `
        <div class="feedback-comment" data-comment-id="${c.id}">
          <div class="comment-header">
            <div class="avatar-bubble avatar-bubble--comment" title="${safe(authorName)}">${initials}</div>
            <span class="comment-meta">${safe(authorName)} • ${date}</span>
            ${canEditComment ? `
              <div class="comment-actions">
                <button class="btn-edit-comment" data-comment-id="${c.id}" data-feedback-id="${feedbackId}" title="Kommentar bearbeiten">
                  ${ICON_EDIT_SMALL}
                </button>
                <button class="btn-delete-comment" data-comment-id="${c.id}" data-feedback-id="${feedbackId}" title="Kommentar löschen">
                  ${ICON_DELETE_SMALL}
                </button>
              </div>
            ` : ''}
          </div>
          <span class="comment-text">${safe(c.text)}</span>
        </div>
      `;
    }).join('');

    // Prüfe ob Kommentare ausgeblendet sind (aus localStorage)
    const isHidden = this.isCommentsHidden(feedbackId);

    return `
      <div class="feedback-comments-section" data-feedback-id="${feedbackId}">
        ${comments.length > 0 ? `
          <div class="feedback-comments-list ${isHidden ? 'hidden' : ''}">
            ${commentsHtml}
          </div>
          <button class="btn-toggle-comments" data-feedback-id="${feedbackId}">
            ${isHidden ? 'Kommentare anzeigen' : 'Kommentare verbergen'}
          </button>
        ` : ''}
        ${canComment ? `
          <div class="feedback-comment-form">
            <div class="feedback-comment-input-wrapper">
              <textarea class="feedback-comment-input" 
                        data-feedback-id="${feedbackId}"
                        rows="1"
                        placeholder="Kommentar eingeben..."></textarea>
              <button type="button" class="btn-send-comment" data-feedback-id="${feedbackId}">${ICON_SEND}</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  },

  // Hilfsfunktionen für Kommentar-Sichtbarkeit (localStorage)
  isCommentsHidden(feedbackId) {
    const userId = window.currentUser?.id;
    if (!userId) return false;
    const key = `feedback_comments_hidden_${userId}`;
    const hiddenIds = JSON.parse(localStorage.getItem(key) || '[]');
    return hiddenIds.includes(feedbackId);
  },

  toggleCommentsVisibility(feedbackId) {
    const userId = window.currentUser?.id;
    if (!userId) return;
    const key = `feedback_comments_hidden_${userId}`;
    let hiddenIds = JSON.parse(localStorage.getItem(key) || '[]');
    
    if (hiddenIds.includes(feedbackId)) {
      hiddenIds = hiddenIds.filter(id => id !== feedbackId);
    } else {
      hiddenIds.push(feedbackId);
    }
    
    localStorage.setItem(key, JSON.stringify(hiddenIds));
    
    // Re-render der Card
    const wrapper = document.querySelector(`.feedback-card-wrapper[data-feedback-id="${feedbackId}"]`);
    if (wrapper) {
      const fb = this.feedbacks.find(f => f.id === feedbackId);
      if (fb) {
        wrapper.outerHTML = this.renderFeedbackCardWrapper(fb);
        this.bindSingleCardEvents(feedbackId);
      }
    }
  },

  bindEvents() {
    // Neues Feedback
    const newBtn = document.getElementById('new-feedback-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        this.createDrawer.open();
      });
    }

    // Add buttons in columns
    document.querySelectorAll('.btn-add-feedback-in-column').forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.dataset.category;
        this.createDrawer.open(category);
      });
    });

    // Filter Events
    const dateFilter = document.getElementById('filter-date');
    if (dateFilter) {
      dateFilter.addEventListener('change', async (e) => {
        this.filters.date = e.target.value || null;
        await this.loadFeedbacks();
        await this.loadComments();
        this.render();
        this.bindEvents();
      });
    }

    const priorityFilter = document.getElementById('filter-priority');
    if (priorityFilter) {
      priorityFilter.addEventListener('change', async (e) => {
        this.filters.priority = e.target.value || null;
        await this.loadFeedbacks();
        await this.loadComments();
        this.render();
        this.bindEvents();
      });
    }

    // Feedback Effort Select (Admin)
    document.querySelectorAll('.feedback-card-effort-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        e.stopPropagation();
        const feedbackId = select.dataset.feedbackId;
        const effort = select.value;
        await this.updateFeedbackEffort(feedbackId, effort);
      });
    });

    // Edit Feedback Events
    document.querySelectorAll('.btn-edit-feedback').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const feedbackId = btn.dataset.feedbackId;
        const feedback = this.feedbacks.find(f => f.id === feedbackId);
        if (feedback) {
          this.createDrawer.open(null, feedback);
        }
      });
    });

    // Delete Feedback Events
    document.querySelectorAll('.btn-delete-feedback').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const feedbackId = btn.dataset.feedbackId;
        await this.deleteFeedback(feedbackId);
      });
    });

    // Archive Feedback Events
    document.querySelectorAll('.btn-archive-feedback').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const feedbackId = btn.dataset.feedbackId;
        await this.archiveFeedback(feedbackId);
      });
    });

    // Comment Input Events (Enter to submit + auto-resize)
    document.querySelectorAll('.feedback-comment-input').forEach(textarea => {
      // Auto-resize
      this.autoResizeTextarea(textarea);
      textarea.addEventListener('input', () => this.autoResizeTextarea(textarea));
      
      textarea.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const feedbackId = textarea.dataset.feedbackId;
          const text = textarea.value.trim();
          if (text) {
            await this.addComment(feedbackId, text);
          }
        }
      });
    });

    // Send Comment Button Events
    document.querySelectorAll('.btn-send-comment').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const feedbackId = btn.dataset.feedbackId;
        const wrapper = btn.closest('.feedback-card-wrapper');
        const input = wrapper?.querySelector('.feedback-comment-input');
        const text = input?.value.trim();
        if (text) {
          await this.addComment(feedbackId, text);
        }
      });
    });

    // Vote Button Events
    document.querySelectorAll('.btn-vote').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const feedbackId = btn.dataset.feedbackId;
        const voteType = btn.dataset.voteType;
        await this.handleVote(feedbackId, voteType);
      });
    });

    // Toggle Comments Visibility
    document.querySelectorAll('.btn-toggle-comments').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const feedbackId = btn.dataset.feedbackId;
        this.toggleCommentsVisibility(feedbackId);
      });
    });

    // Edit Comment Events
    document.querySelectorAll('.btn-edit-comment').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const commentId = btn.dataset.commentId;
        const feedbackId = btn.dataset.feedbackId;
        this.startEditComment(commentId, feedbackId);
      });
    });

    // Drag & Drop Events
    this.bindDragDropEvents();

    // Event für Drawer-Refresh
    window.addEventListener('feedbackCreated', this.handleFeedbackCreated.bind(this));
  },

  autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  },

  startEditComment(commentId, feedbackId) {
    this.editingCommentId = commentId;
    // Re-render nur diese Card
    const wrapper = document.querySelector(`.feedback-card-wrapper[data-feedback-id="${feedbackId}"]`);
    if (wrapper) {
      const fb = this.feedbacks.find(f => f.id === feedbackId);
      if (fb) {
        wrapper.outerHTML = this.renderFeedbackCardWrapper(fb);
        this.bindSingleCardEvents(feedbackId);
        // Focus auf Textarea
        const textarea = document.querySelector(`.comment-edit-input[data-comment-id="${commentId}"]`);
        if (textarea) {
          this.autoResizeTextarea(textarea);
          textarea.focus();
          // Cursor ans Ende setzen
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
      }
    }
  },

  cancelEditComment(feedbackId) {
    this.editingCommentId = null;
    const wrapper = document.querySelector(`.feedback-card-wrapper[data-feedback-id="${feedbackId}"]`);
    if (wrapper) {
      const fb = this.feedbacks.find(f => f.id === feedbackId);
      if (fb) {
        wrapper.outerHTML = this.renderFeedbackCardWrapper(fb);
        this.bindSingleCardEvents(feedbackId);
      }
    }
  },

  async saveEditComment(commentId, feedbackId, newText) {
    if (!newText.trim()) {
      window.toastSystem?.show('Kommentar darf nicht leer sein', 'warning');
      return;
    }

    const { error } = await window.supabase
      .from('feedback_comments')
      .update({ text: newText.trim() })
      .eq('id', commentId);

    if (error) {
      console.error('Fehler beim Speichern:', error);
      window.toastSystem?.show('Fehler beim Speichern', 'error');
      return;
    }

    // Lokalen State aktualisieren
    const feedbackComments = this.comments[feedbackId];
    if (feedbackComments) {
      const comment = feedbackComments.find(c => c.id === commentId);
      if (comment) {
        comment.text = newText.trim();
      }
    }

    this.editingCommentId = null;
    window.toastSystem?.show('Kommentar aktualisiert', 'success');

    // Re-render
    const wrapper = document.querySelector(`.feedback-card-wrapper[data-feedback-id="${feedbackId}"]`);
    if (wrapper) {
      const fb = this.feedbacks.find(f => f.id === feedbackId);
      if (fb) {
        wrapper.outerHTML = this.renderFeedbackCardWrapper(fb);
        this.bindSingleCardEvents(feedbackId);
      }
    }
  },

  async addComment(feedbackId, text) {
    if (!window.supabase) return;

    const { data, error } = await window.supabase
      .from('feedback_comments')
      .insert({
        feedback_id: feedbackId,
        text,
        author_id: window.currentUser?.id
      })
      .select(`*, author:author_id(id, name)`)
      .single();

    if (error) {
      console.error('Fehler beim Speichern des Kommentars:', error);
      window.toastSystem?.show('Fehler beim Speichern', 'error');
      return;
    }

    // Lokalen State aktualisieren
    if (!this.comments[feedbackId]) {
      this.comments[feedbackId] = [];
    }
    this.comments[feedbackId].push(data);

    window.toastSystem?.show('Kommentar hinzugefügt', 'success');

    // Nur den betroffenen Wrapper neu rendern
    const wrapper = document.querySelector(`.feedback-card-wrapper[data-feedback-id="${feedbackId}"]`);
    if (wrapper) {
      const fb = this.feedbacks.find(f => f.id === feedbackId);
      if (fb) {
        wrapper.outerHTML = this.renderFeedbackCardWrapper(fb);
        // Events für das neue Element binden
        this.bindSingleCardEvents(feedbackId);
      }
    }
  },

  async updateFeedbackEffort(feedbackId, effort) {
    if (!window.supabase) return;

    const { error } = await window.supabase
      .from('feedback')
      .update({ effort: effort || null })
      .eq('id', feedbackId);

    if (error) {
      console.error('Fehler beim Aktualisieren des Aufwands:', error);
      window.toastSystem?.show('Fehler beim Speichern', 'error');
      return;
    }

    // Lokalen State aktualisieren
    const fb = this.feedbacks.find(f => f.id === feedbackId);
    if (fb) {
      fb.effort = effort || null;
    }

    const effortLabels = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch' };
    const label = effort ? effortLabels[effort] : 'kein';
    window.toastSystem?.show(`Aufwand auf "${label}" gesetzt`, 'success');
  },

  async archiveFeedback(feedbackId) {
    if (!window.supabase) return;

    const fb = this.feedbacks.find(f => f.id === feedbackId);
    if (!fb) return;

    const newArchivedState = !fb.archived;

    const { error } = await window.supabase
      .from('feedback')
      .update({ archived: newArchivedState })
      .eq('id', feedbackId);

    if (error) {
      console.error('Fehler beim Archivieren:', error);
      window.toastSystem?.show('Fehler beim Archivieren', 'error');
      return;
    }

    // Lokalen State aktualisieren
    fb.archived = newArchivedState;

    window.toastSystem?.show(
      newArchivedState ? 'Feedback archiviert' : 'Archivierung aufgehoben', 
      'success'
    );

    // Re-render um Sortierung zu aktualisieren
    this.render();
    this.bindEvents();
  },

  async deleteComment(commentId, feedbackId) {
    // Bestätigung
    let confirmed = false;
    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({
        title: 'Kommentar löschen',
        message: 'Möchtest du diesen Kommentar wirklich löschen?',
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        danger: true
      });
      confirmed = !!res?.confirmed;
    } else {
      confirmed = confirm('Möchtest du diesen Kommentar wirklich löschen?');
    }

    if (!confirmed) return;

    const { error } = await window.supabase
      .from('feedback_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Fehler beim Löschen:', error);
      window.toastSystem?.show('Fehler beim Löschen', 'error');
      return;
    }

    // Lokalen State aktualisieren
    if (this.comments[feedbackId]) {
      this.comments[feedbackId] = this.comments[feedbackId].filter(c => c.id !== commentId);
    }

    window.toastSystem?.show('Kommentar gelöscht', 'success');

    // Re-render
    const wrapper = document.querySelector(`.feedback-card-wrapper[data-feedback-id="${feedbackId}"]`);
    if (wrapper) {
      const fb = this.feedbacks.find(f => f.id === feedbackId);
      if (fb) {
        wrapper.outerHTML = this.renderFeedbackCardWrapper(fb);
        this.bindSingleCardEvents(feedbackId);
      }
    }
  },

  async handleVote(feedbackId, voteType) {
    if (!window.supabase || !window.currentUser?.id) return;

    const currentVote = this.votes[feedbackId]?.userVote;
    
    // Wenn bereits derselbe Vote existiert -> Vote entfernen
    if (currentVote === voteType) {
      const { error } = await window.supabase
        .from('feedback_votes')
        .delete()
        .eq('feedback_id', feedbackId)
        .eq('user_id', window.currentUser.id);

      if (error) {
        console.error('Fehler beim Entfernen des Votes:', error);
        return;
      }

      // Lokalen State aktualisieren
      if (voteType === 'up') {
        this.votes[feedbackId].upvotes--;
      } else {
        this.votes[feedbackId].downvotes--;
      }
      this.votes[feedbackId].userVote = null;
    } 
    // Wenn anderer Vote existiert -> Vote ändern (upsert)
    else if (currentVote) {
      const { error } = await window.supabase
        .from('feedback_votes')
        .update({ vote_type: voteType })
        .eq('feedback_id', feedbackId)
        .eq('user_id', window.currentUser.id);

      if (error) {
        console.error('Fehler beim Ändern des Votes:', error);
        return;
      }

      // Lokalen State aktualisieren
      if (currentVote === 'up') {
        this.votes[feedbackId].upvotes--;
        this.votes[feedbackId].downvotes++;
      } else {
        this.votes[feedbackId].downvotes--;
        this.votes[feedbackId].upvotes++;
      }
      this.votes[feedbackId].userVote = voteType;
    }
    // Neuer Vote
    else {
      const { error } = await window.supabase
        .from('feedback_votes')
        .insert({
          feedback_id: feedbackId,
          user_id: window.currentUser.id,
          vote_type: voteType
        });

      if (error) {
        console.error('Fehler beim Speichern des Votes:', error);
        return;
      }

      // Lokalen State aktualisieren
      if (!this.votes[feedbackId]) {
        this.votes[feedbackId] = { upvotes: 0, downvotes: 0, userVote: null };
      }
      if (voteType === 'up') {
        this.votes[feedbackId].upvotes++;
      } else {
        this.votes[feedbackId].downvotes++;
      }
      this.votes[feedbackId].userVote = voteType;
    }

    // Re-render der Card
    const wrapper = document.querySelector(`.feedback-card-wrapper[data-feedback-id="${feedbackId}"]`);
    if (wrapper) {
      const fb = this.feedbacks.find(f => f.id === feedbackId);
      if (fb) {
        wrapper.outerHTML = this.renderFeedbackCardWrapper(fb);
        this.bindSingleCardEvents(feedbackId);
      }
    }
  },

  bindSingleCardEvents(feedbackId) {
    const wrapper = document.querySelector(`.feedback-card-wrapper[data-feedback-id="${feedbackId}"]`);
    if (!wrapper) return;

    // Effort Select (Admin)
    const effortSelect = wrapper.querySelector('.feedback-card-effort-select');
    if (effortSelect) {
      effortSelect.addEventListener('change', async (e) => {
        e.stopPropagation();
        const effort = effortSelect.value;
        await this.updateFeedbackEffort(feedbackId, effort);
      });
    }

    // Edit Feedback Button
    const editBtn = wrapper.querySelector('.btn-edit-feedback');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const feedback = this.feedbacks.find(f => f.id === feedbackId);
        if (feedback) {
          this.createDrawer.open(null, feedback);
        }
      });
    }

    // Delete Feedback Button
    const deleteBtn = wrapper.querySelector('.btn-delete-feedback');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.deleteFeedback(feedbackId);
      });
    }

    // Archive Feedback Button
    const archiveBtn = wrapper.querySelector('.btn-archive-feedback');
    if (archiveBtn) {
      archiveBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.archiveFeedback(feedbackId);
      });
    }

    // Comment Input (Textarea)
    const commentInput = wrapper.querySelector('.feedback-comment-input');
    if (commentInput) {
      // Auto-resize
      this.autoResizeTextarea(commentInput);
      commentInput.addEventListener('input', () => this.autoResizeTextarea(commentInput));
      
      commentInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const text = commentInput.value.trim();
          if (text) {
            await this.addComment(feedbackId, text);
          }
        }
      });
    }

    // Send Comment Button
    const sendBtn = wrapper.querySelector('.btn-send-comment');
    if (sendBtn) {
      sendBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const input = wrapper.querySelector('.feedback-comment-input');
        const text = input?.value.trim();
        if (text) {
          await this.addComment(feedbackId, text);
        }
      });
    }

    // Vote Buttons
    wrapper.querySelectorAll('.btn-vote').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const voteType = btn.dataset.voteType;
        await this.handleVote(feedbackId, voteType);
      });
    });

    // Toggle Comments Button
    const toggleBtn = wrapper.querySelector('.btn-toggle-comments');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCommentsVisibility(feedbackId);
      });
    }

    // Edit Comment Buttons
    wrapper.querySelectorAll('.btn-edit-comment').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const commentId = btn.dataset.commentId;
        this.startEditComment(commentId, feedbackId);
      });
    });

    // Delete Comment Buttons
    wrapper.querySelectorAll('.btn-delete-comment').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const commentId = btn.dataset.commentId;
        await this.deleteComment(commentId, feedbackId);
      });
    });

    // Cancel Edit Button
    const cancelBtn = wrapper.querySelector('.btn-cancel-edit');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cancelEditComment(feedbackId);
      });
    }

    // Save Edit Button
    const saveBtn = wrapper.querySelector('.btn-save-edit');
    if (saveBtn) {
      saveBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const commentId = saveBtn.dataset.commentId;
        const input = wrapper.querySelector(`.comment-edit-input[data-comment-id="${commentId}"]`);
        if (input) {
          await this.saveEditComment(commentId, feedbackId, input.value);
        }
      });
    }

    // Edit Input (Textarea) - Enter to save, Shift+Enter for newline
    const editInput = wrapper.querySelector('.comment-edit-input');
    if (editInput) {
      // Auto-resize
      this.autoResizeTextarea(editInput);
      editInput.addEventListener('input', () => this.autoResizeTextarea(editInput));
      
      editInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const commentId = editInput.dataset.commentId;
          await this.saveEditComment(commentId, feedbackId, editInput.value);
        }
      });
      editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.cancelEditComment(feedbackId);
        }
      });
    }

    // Drag events for card
    const card = wrapper.querySelector('.feedback-card');
    if (card) {
      card.addEventListener('dragstart', (e) => this.onDragStart(e));
      card.addEventListener('dragend', (e) => this.onDragEnd(e));
    }
  },

  async deleteFeedback(feedbackId) {
    // Bestätigung via ConfirmationModal falls vorhanden
    let confirmed = false;
    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({
        title: 'Feedback löschen',
        message: 'Möchtest du dieses Feedback wirklich löschen?',
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        danger: true
      });
      confirmed = !!res?.confirmed;
    } else {
      confirmed = confirm('Möchtest du dieses Feedback wirklich löschen?');
    }

    if (!confirmed) return;

    const { error } = await window.supabase
      .from('feedback')
      .delete()
      .eq('id', feedbackId)
      .eq('created_by', window.currentUser?.id); // Extra Sicherheit

    if (error) {
      console.error('Fehler beim Löschen:', error);
      window.toastSystem?.show('Fehler beim Löschen', 'error');
      return;
    }

    window.toastSystem?.show('Feedback gelöscht', 'success');
    await this.loadFeedbacks();
    await this.loadComments();
    this.render();
    this.bindEvents();
  },

  handleFeedbackCreated: async function() {
    await this.loadFeedbacks();
    await this.loadComments();
    this.render();
    this.bindEvents();
  },

  bindDragDropEvents() {
    const cards = document.querySelectorAll('.feedback-card');
    const columns = document.querySelectorAll('.kanban-column-body');

    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => this.onDragStart(e));
      card.addEventListener('dragend', (e) => this.onDragEnd(e));
    });

    columns.forEach(column => {
      column.addEventListener('dragover', (e) => this.onDragOver(e));
      column.addEventListener('dragleave', (e) => this.onDragLeave(e));
      column.addEventListener('drop', (e) => this.onDrop(e));
    });
  },

  onDragStart(e) {
    const card = e.target.closest('.feedback-card');
    if (!card) return;

    this.draggedFeedback = {
      id: card.dataset.feedbackId,
      category: card.dataset.category,
      status: card.dataset.status
    };

    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  },

  onDragEnd(e) {
    const card = e.target.closest('.feedback-card');
    if (card) {
      card.classList.remove('dragging');
    }
    this.draggedFeedback = null;

    // Remove all drag-over states
    document.querySelectorAll('.kanban-column-body').forEach(col => {
      col.classList.remove('drag-over');
    });
  },

  onDragOver(e) {
    e.preventDefault();
    const column = e.target.closest('.kanban-column-body');
    if (!column) return;

    const targetColumn = column.dataset.column;
    
    // Nur Admins dürfen in Status-Spalten verschieben
    const adminOnlyColumns = ['closed', 'in_progress', 'additions', 'backlog'];
    if (adminOnlyColumns.includes(targetColumn) && !this.isAdmin) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    e.dataTransfer.dropEffect = 'move';
    column.classList.add('drag-over');
  },

  onDragLeave(e) {
    const column = e.target.closest('.kanban-column-body');
    if (column && !column.contains(e.relatedTarget)) {
      column.classList.remove('drag-over');
    }
  },

  async onDrop(e) {
    e.preventDefault();
    const column = e.target.closest('.kanban-column-body');
    if (!column || !this.draggedFeedback) return;

    column.classList.remove('drag-over');

    const targetColumn = column.dataset.column;
    const feedbackId = this.draggedFeedback.id;
    const currentCategory = this.draggedFeedback.category;
    const currentStatus = this.draggedFeedback.status;

    // Nur Admins dürfen in Status-Spalten verschieben
    const adminOnlyColumns = ['closed', 'in_progress', 'additions', 'backlog'];
    if (adminOnlyColumns.includes(targetColumn) && !this.isAdmin) {
      window.toastSystem?.show('Nur Admins können den Status ändern', 'warning');
      return;
    }

    // Bestimme neue Werte
    let newCategory = currentCategory;
    let newStatus = currentStatus;

    if (targetColumn === 'closed') {
      newStatus = 'closed';
    } else if (targetColumn === 'in_progress') {
      newStatus = 'in_progress';
    } else if (targetColumn === 'additions') {
      newStatus = 'additions';
    } else if (targetColumn === 'backlog') {
      newStatus = 'backlog';
    } else if (targetColumn === 'bug' || targetColumn === 'feature') {
      newCategory = targetColumn;
      newStatus = 'open';
    }

    // Keine Änderung nötig?
    if (newCategory === currentCategory && newStatus === currentStatus) {
      return;
    }

    // Update in DB
    const { error } = await window.supabase
      .from('feedback')
      .update({ 
        category: newCategory,
        status: newStatus 
      })
      .eq('id', feedbackId);

    if (error) {
      console.error('Fehler beim Verschieben:', error);
      window.toastSystem?.show('Fehler beim Verschieben', 'error');
      return;
    }

    const statusLabels = {
      'closed': 'Erledigt',
      'in_progress': 'In Bearbeitung',
      'additions': 'Ergänzungen',
      'backlog': 'Backlog/Hold',
      'open': newCategory === 'bug' ? 'Bugs' : 'Features'
    };
    window.toastSystem?.show(`Feedback nach "${statusLabels[newStatus]}" verschoben`, 'success');

    // Reload
    await this.loadFeedbacks();
    await this.loadComments();
    this.render();
    this.bindEvents();
  },

  destroy() {
    console.log('🗑️ FeedbackPage: destroy()');
    window.removeEventListener('feedbackCreated', this.handleFeedbackCreated);
  }
};
