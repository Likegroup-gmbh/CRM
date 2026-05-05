// FeedbackEventHandler.js
// Event-Binding, Drag & Drop und UI-Helfer fuer das Feedback-Modul

import { STATUS_LABELS } from './FeedbackConstants.js';
import * as dataService from './FeedbackDataService.js';

// === Main Event Binding ===

export function bindEvents(ctx) {
  ctx._abortController?.abort();
  ctx._abortController = new AbortController();
  const { signal } = ctx._abortController;

  if (!ctx._handleFeedbackCreated) {
    ctx._handleFeedbackCreated = () => ctx.refresh();
  }

  // Neues Feedback
  const newBtn = document.getElementById('new-feedback-btn');
  if (newBtn) {
    newBtn.addEventListener('click', () => ctx.createDrawer.open());
  }

  // Add buttons in columns
  document.querySelectorAll('.btn-add-feedback-in-column').forEach(btn => {
    btn.addEventListener('click', () => ctx.createDrawer.open(btn.dataset.category));
  });

  // Filter Events
  bindFilterEvents(ctx);

  // Card-level events (effort, edit, delete, archive, comments, votes, merge)
  bindCardEvents(ctx);

  // Drag & Drop
  bindDragDropEvents(ctx);

  // Drawer-Refresh
  window.addEventListener('feedbackCreated', ctx._handleFeedbackCreated, { signal });
}

function bindFilterEvents(ctx) {
  const dateFilter = document.getElementById('filter-date');
  if (dateFilter) {
    dateFilter.addEventListener('change', async (e) => {
      ctx.filters.date = e.target.value || null;
      await ctx.refresh();
    });
  }

  const areaFilter = document.getElementById('filter-area');
  if (areaFilter) {
    areaFilter.addEventListener('change', async (e) => {
      ctx.filters.area = e.target.value || null;
      await ctx.refresh();
    });
  }

  const priorityFilter = document.getElementById('filter-priority');
  if (priorityFilter) {
    priorityFilter.addEventListener('change', async (e) => {
      ctx.filters.priority = e.target.value || null;
      await ctx.refresh();
    });
  }

  const creatorFilter = document.getElementById('filter-creator');
  if (creatorFilter) {
    creatorFilter.addEventListener('change', async (e) => {
      ctx.filters.creator = e.target.value || null;
      await ctx.refresh();
    });
  }
}

function bindCardEvents(ctx) {
  document.querySelectorAll('.feedback-card-effort-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      e.stopPropagation();
      await dataService.updateFeedbackEffort(ctx, select.dataset.feedbackId, select.value);
    });
  });

  document.querySelectorAll('.btn-edit-feedback').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const feedback = ctx.feedbacks.find(f => f.id === btn.dataset.feedbackId);
      if (feedback) ctx.createDrawer.open(null, feedback);
    });
  });

  document.querySelectorAll('.btn-delete-feedback').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await dataService.deleteFeedback(ctx, btn.dataset.feedbackId);
    });
  });

  document.querySelectorAll('.btn-archive-feedback').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await dataService.archiveFeedback(ctx, btn.dataset.feedbackId);
    });
  });

  document.querySelectorAll('.feedback-comment-input').forEach(textarea => {
    autoResizeTextarea(textarea);
    textarea.addEventListener('input', () => autoResizeTextarea(textarea));
    textarea.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = textarea.value.trim();
        if (text) await dataService.addComment(ctx, textarea.dataset.feedbackId, text);
      }
    });
  });

  document.querySelectorAll('.btn-send-comment').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const wrapper = btn.closest('.feedback-card-wrapper');
      const input = wrapper?.querySelector('.feedback-comment-input');
      const text = input?.value.trim();
      if (text) await dataService.addComment(ctx, btn.dataset.feedbackId, text);
    });
  });

  document.querySelectorAll('.btn-vote').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await dataService.handleVote(ctx, btn.dataset.feedbackId, btn.dataset.voteType);
    });
  });

  document.querySelectorAll('.btn-toggle-comments').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCommentsVisibility(ctx, btn.dataset.feedbackId);
    });
  });

  document.querySelectorAll('.btn-edit-comment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      startEditComment(ctx, btn.dataset.commentId, btn.dataset.feedbackId);
    });
  });

  document.querySelectorAll('.feedback-merged-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMergedItemsVisibility(btn.dataset.parentId);
    });
  });

  document.querySelectorAll('.btn-unmerge-feedback').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await dataService.unmergeFeedback(ctx, btn.dataset.childId);
    });
  });
}

// === Single Card Event Binding (nach Card-Re-render) ===

export function bindSingleCardEvents(ctx, feedbackId) {
  const wrapper = document.querySelector(`.feedback-card-wrapper[data-feedback-id="${feedbackId}"]`);
  if (!wrapper) return;

  const effortSelect = wrapper.querySelector('.feedback-card-effort-select');
  if (effortSelect) {
    effortSelect.addEventListener('change', async (e) => {
      e.stopPropagation();
      await dataService.updateFeedbackEffort(ctx, feedbackId, effortSelect.value);
    });
  }

  const editBtn = wrapper.querySelector('.btn-edit-feedback');
  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const feedback = ctx.feedbacks.find(f => f.id === feedbackId);
      if (feedback) ctx.createDrawer.open(null, feedback);
    });
  }

  const deleteBtn = wrapper.querySelector('.btn-delete-feedback');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await dataService.deleteFeedback(ctx, feedbackId);
    });
  }

  const archiveBtn = wrapper.querySelector('.btn-archive-feedback');
  if (archiveBtn) {
    archiveBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await dataService.archiveFeedback(ctx, feedbackId);
    });
  }

  const commentInput = wrapper.querySelector('.feedback-comment-input');
  if (commentInput) {
    autoResizeTextarea(commentInput);
    commentInput.addEventListener('input', () => autoResizeTextarea(commentInput));
    commentInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = commentInput.value.trim();
        if (text) await dataService.addComment(ctx, feedbackId, text);
      }
    });
  }

  const sendBtn = wrapper.querySelector('.btn-send-comment');
  if (sendBtn) {
    sendBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const input = wrapper.querySelector('.feedback-comment-input');
      const text = input?.value.trim();
      if (text) await dataService.addComment(ctx, feedbackId, text);
    });
  }

  wrapper.querySelectorAll('.btn-vote').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await dataService.handleVote(ctx, feedbackId, btn.dataset.voteType);
    });
  });

  const toggleBtn = wrapper.querySelector('.btn-toggle-comments');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCommentsVisibility(ctx, feedbackId);
    });
  }

  wrapper.querySelectorAll('.btn-edit-comment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      startEditComment(ctx, btn.dataset.commentId, feedbackId);
    });
  });

  wrapper.querySelectorAll('.btn-delete-comment').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await dataService.deleteComment(ctx, btn.dataset.commentId, feedbackId);
    });
  });

  const cancelBtn = wrapper.querySelector('.btn-cancel-edit');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelEditComment(ctx, feedbackId);
    });
  }

  const saveBtn = wrapper.querySelector('.btn-save-edit');
  if (saveBtn) {
    saveBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const input = wrapper.querySelector(`.comment-edit-input[data-comment-id="${saveBtn.dataset.commentId}"]`);
      if (input) await dataService.saveEditComment(ctx, saveBtn.dataset.commentId, feedbackId, input.value);
    });
  }

  const editInput = wrapper.querySelector('.comment-edit-input');
  if (editInput) {
    autoResizeTextarea(editInput);
    editInput.addEventListener('input', () => autoResizeTextarea(editInput));
    editInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        await dataService.saveEditComment(ctx, editInput.dataset.commentId, feedbackId, editInput.value);
      }
    });
    editInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cancelEditComment(ctx, feedbackId);
    });
  }

  const mergedToggle = wrapper.querySelector('.feedback-merged-toggle');
  if (mergedToggle) {
    mergedToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMergedItemsVisibility(mergedToggle.dataset.parentId);
    });
  }

  wrapper.querySelectorAll('.btn-unmerge-feedback').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await dataService.unmergeFeedback(ctx, btn.dataset.childId);
    });
  });

  const card = wrapper.querySelector('.feedback-card');
  if (card) {
    card.addEventListener('dragstart', (e) => onDragStart(ctx, e));
    card.addEventListener('dragend', (e) => onDragEnd(ctx, e));
  }
}

// === Drag & Drop ===

export function bindDragDropEvents(ctx) {
  document.querySelectorAll('.feedback-card').forEach(card => {
    card.addEventListener('dragstart', (e) => onDragStart(ctx, e));
    card.addEventListener('dragend', (e) => onDragEnd(ctx, e));
  });

  document.querySelectorAll('.kanban-column-body').forEach(column => {
    column.addEventListener('dragover', (e) => onDragOver(ctx, e));
    column.addEventListener('dragleave', (e) => onDragLeave(ctx, e));
    column.addEventListener('drop', (e) => onDrop(ctx, e));
  });
}

function onDragStart(ctx, e) {
  const card = e.target.closest('.feedback-card');
  if (!card) return;
  ctx.draggedFeedback = { id: card.dataset.feedbackId, category: card.dataset.category, status: card.dataset.status };
  ctx.draggedElement = card;
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(ctx, e) {
  const card = e.target.closest('.feedback-card');
  if (card) card.classList.remove('dragging');
  ctx.draggedFeedback = null;
  ctx.draggedElement = null;
  clearMergeTimer(ctx);
  ctx.mergeZoneActive = false;

  document.querySelectorAll('.kanban-column-body').forEach(col => col.classList.remove('drag-over'));
  document.querySelectorAll('.feedback-card').forEach(c => c.classList.remove('merge-target'));
}

function clearMergeTimer(ctx) {
  if (ctx.mergeTimer) { clearTimeout(ctx.mergeTimer); ctx.mergeTimer = null; }
  ctx.mergeTarget = null;
}

function onDragOver(ctx, e) {
  e.preventDefault();
  if (!ctx.draggedFeedback || !ctx.isAdmin) {
    e.dataTransfer.dropEffect = 'none';
    return;
  }

  const column = e.target.closest('.kanban-column-body');
  if (!column) return;

  const targetCard = e.target.closest('.feedback-card');
  if (targetCard && targetCard !== ctx.draggedElement) {
    const targetId = targetCard.dataset.feedbackId;
    if (ctx.mergeTarget !== targetId) {
      clearMergeTimer(ctx);
      ctx.mergeTarget = targetId;
      document.querySelectorAll('.feedback-card.merge-target').forEach(c => c.classList.remove('merge-target'));
      ctx.mergeTimer = setTimeout(() => {
        targetCard.classList.add('merge-target');
        ctx.mergeZoneActive = true;
      }, 800);
    }
    e.dataTransfer.dropEffect = 'move';
    return;
  }

  clearMergeTimer(ctx);
  ctx.mergeZoneActive = false;
  document.querySelectorAll('.feedback-card.merge-target').forEach(c => c.classList.remove('merge-target'));

  const targetColumn = column.dataset.column;
  const adminOnlyColumns = ['closed', 'in_progress', 'additions', 'backlog'];
  if (adminOnlyColumns.includes(targetColumn) && !ctx.isAdmin) {
    e.dataTransfer.dropEffect = 'none';
    return;
  }

  e.dataTransfer.dropEffect = 'move';
  column.classList.add('drag-over');
}

function onDragLeave(ctx, e) {
  const column = e.target.closest('.kanban-column-body');
  if (column && !column.contains(e.relatedTarget)) column.classList.remove('drag-over');

  const card = e.target.closest('.feedback-card');
  if (card && !card.contains(e.relatedTarget) && card.dataset.feedbackId === ctx.mergeTarget) {
    clearMergeTimer(ctx);
    card.classList.remove('merge-target');
    ctx.mergeZoneActive = false;
  }
}

async function onDrop(ctx, e) {
  e.preventDefault();
  if (!ctx.draggedFeedback) return;

  const feedbackId = ctx.draggedFeedback.id;
  const currentCategory = ctx.draggedFeedback.category;
  const currentStatus = ctx.draggedFeedback.status;

  const targetCard = e.target.closest('.feedback-card');
  if (targetCard && targetCard.classList.contains('merge-target') && ctx.mergeZoneActive) {
    const targetId = targetCard.dataset.feedbackId;
    targetCard.classList.remove('merge-target');
    clearMergeTimer(ctx);
    ctx.mergeZoneActive = false;
    await dataService.mergeFeedback(ctx, feedbackId, targetId);
    return;
  }

  const column = e.target.closest('.kanban-column-body');
  if (!column) return;
  column.classList.remove('drag-over');

  const targetColumn = column.dataset.column;
  const adminOnlyColumns = ['closed', 'in_progress', 'additions', 'backlog'];
  if (adminOnlyColumns.includes(targetColumn) && !ctx.isAdmin) {
    window.toastSystem?.show('Nur Admins können den Status ändern', 'warning');
    return;
  }

  let newCategory = currentCategory;
  let newStatus = currentStatus;

  if (targetColumn === 'closed') newStatus = 'closed';
  else if (targetColumn === 'in_progress') newStatus = 'in_progress';
  else if (targetColumn === 'additions') newStatus = 'additions';
  else if (targetColumn === 'backlog') newStatus = 'backlog';
  else if (targetColumn === 'bug' || targetColumn === 'feature') { newCategory = targetColumn; newStatus = 'open'; }

  if (newCategory === currentCategory && newStatus === currentStatus) return;

  const success = await dataService.moveFeedback(ctx, feedbackId, newCategory, newStatus);
  if (!success) return;

  const label = STATUS_LABELS[newStatus] || (newCategory === 'bug' ? 'Bugs' : 'Features');
  window.toastSystem?.show(`Feedback nach "${label}" verschoben`, 'success');
  await ctx.refresh();
}

// === UI Helpers ===

export function autoResizeTextarea(textarea) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

export function startEditComment(ctx, commentId, feedbackId) {
  ctx.editingCommentId = commentId;
  ctx.rerenderCard(feedbackId);
  const textarea = document.querySelector(`.comment-edit-input[data-comment-id="${commentId}"]`);
  if (textarea) {
    autoResizeTextarea(textarea);
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }
}

export function cancelEditComment(ctx, feedbackId) {
  ctx.editingCommentId = null;
  ctx.rerenderCard(feedbackId);
}

// === Visibility Toggles (localStorage) ===

export function isCommentsHidden(feedbackId) {
  const userId = window.currentUser?.id;
  if (!userId) return false;
  const hiddenIds = JSON.parse(localStorage.getItem(`feedback_comments_hidden_${userId}`) || '[]');
  return hiddenIds.includes(feedbackId);
}

export function toggleCommentsVisibility(ctx, feedbackId) {
  const userId = window.currentUser?.id;
  if (!userId) return;
  const key = `feedback_comments_hidden_${userId}`;
  let hiddenIds = JSON.parse(localStorage.getItem(key) || '[]');

  if (hiddenIds.includes(feedbackId)) hiddenIds = hiddenIds.filter(id => id !== feedbackId);
  else hiddenIds.push(feedbackId);

  localStorage.setItem(key, JSON.stringify(hiddenIds));
  ctx.rerenderCard(feedbackId);
}

export function isMergedItemsExpanded(parentId) {
  const userId = window.currentUser?.id;
  if (!userId) return false;
  const expandedIds = JSON.parse(localStorage.getItem(`feedback_merged_expanded_${userId}`) || '[]');
  return expandedIds.includes(parentId);
}

export function toggleMergedItemsVisibility(parentId) {
  const userId = window.currentUser?.id;
  if (!userId) return;
  const key = `feedback_merged_expanded_${userId}`;
  let expandedIds = JSON.parse(localStorage.getItem(key) || '[]');

  if (expandedIds.includes(parentId)) expandedIds = expandedIds.filter(id => id !== parentId);
  else expandedIds.push(parentId);

  localStorage.setItem(key, JSON.stringify(expandedIds));

  const section = document.querySelector(`.feedback-merged-items[data-parent-id="${parentId}"]`);
  if (section) {
    const toggle = section.querySelector('.feedback-merged-toggle');
    const list = section.querySelector('.feedback-merged-list');
    if (toggle && list) {
      toggle.classList.toggle('expanded');
      list.classList.toggle('hidden');
    }
  }
}
