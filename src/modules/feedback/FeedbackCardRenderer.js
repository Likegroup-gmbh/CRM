// FeedbackCardRenderer.js
// HTML-Rendering fuer Feedback-Karten, Spalten, Kommentare und Merge-Sections

import {
  ICON_ARCHIVE, ICON_UNARCHIVE, ICON_DELETE, ICON_EDIT,
  ICON_EDIT_SMALL, ICON_DELETE_SMALL, ICON_SEND, ICON_COMMENT,
  ICON_UPVOTE, ICON_DOWNVOTE, ICON_MERGE, ICON_UNMERGE, ICON_CHEVRON_DOWN,
  AREA_LABELS, PRIORITY_CLASSES, PRIORITY_LABELS, EFFORT_LABELS,
  safe, formatDateDE, getInitials
} from './FeedbackConstants.js';

export function renderColumn(ctx, columnId, title, feedbacks, icon = '', isStatusColumn = false) {
  const showAddButton = !isStatusColumn;

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
          <div class="kanban-empty-state"><p>Keine Einträge</p></div>
        ` : feedbacks.map(fb => renderFeedbackCardWrapper(ctx, fb)).join('')}
      </div>
    </div>
  `;
}

export function renderFeedbackCardWrapper(ctx, fb) {
  const feedbackComments = ctx.comments[fb.id] || [];
  const hasComments = feedbackComments.length > 0;
  const canComment = ctx.isAdmin || hasComments;
  const isArchived = fb.archived === true;
  const wrapperArchivedClass = isArchived ? 'feedback-card-wrapper--archived' : '';
  const childItems = ctx.childFeedbacks[fb.id] || [];
  const hasMergedItems = childItems.length > 0;

  return `
    <div class="feedback-card-wrapper ${wrapperArchivedClass}" data-feedback-id="${fb.id}">
      ${renderFeedbackCard(ctx, fb, feedbackComments)}
      ${hasMergedItems ? renderMergedItemsSection(ctx, fb.id, childItems) : ''}
      ${renderCommentsSection(ctx, fb.id, feedbackComments, canComment)}
    </div>
  `;
}

export function renderFeedbackCard(ctx, fb, feedbackComments = []) {
  const priorityClass = PRIORITY_CLASSES[fb.priority] || 'priority-medium';
  const priorityLabel = PRIORITY_LABELS[fb.priority] || 'Mittel';
  const areaLabel = fb.area ? AREA_LABELS[fb.area] : null;
  const formattedDate = formatDateDE(fb.created_at);
  const canEdit = fb.created_by === window.currentUser?.id;
  const canDelete = fb.created_by === window.currentUser?.id;
  const commentCount = feedbackComments.length;
  const isFeature = fb.category === 'feature';
  const voteData = ctx.votes[fb.id] || { upvotes: 0, downvotes: 0, userVote: null };
  const hasUpvoted = voteData.userVote === 'up';
  const hasDownvoted = voteData.userVote === 'down';
  const effortLabel = fb.effort ? EFFORT_LABELS[fb.effort] : null;
  const isArchived = fb.archived === true;
  const archivedClass = isArchived ? 'feedback-card--archived' : '';
  const canArchive = ctx.isAdmin && fb.status === 'closed';
  const childCount = (ctx.childFeedbacks[fb.id] || []).length;
  const hasMergedItems = childCount > 0;

  return `
    <div class="task-card feedback-card ${priorityClass} ${archivedClass}" 
         draggable="${ctx.isAdmin ? 'true' : 'false'}" 
         data-feedback-id="${fb.id}"
         data-category="${fb.category}"
         data-status="${fb.status}"
         data-archived="${isArchived}">
      
      <div class="task-card-header">
        <div class="feedback-card-meta">
          <div class="task-priority-badge">
            <span class="task-priority-indicator"></span>
            <span class="task-priority-text">${priorityLabel}</span>
          </div>
          ${areaLabel ? `<span class="feedback-area-badge">${areaLabel}</span>` : ''}
          ${hasMergedItems ? `
            <span class="feedback-merge-badge" title="${childCount} zusammengeführte${childCount > 1 ? ' Tickets' : 's Ticket'}">
              ${ICON_MERGE}
              <span class="merge-count">${childCount}</span>
            </span>
          ` : ''}
        </div>
        <div class="feedback-card-actions">
          ${ctx.isAdmin ? `
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
              <button class="btn-vote btn-upvote ${hasUpvoted ? 'active' : ''}" data-feedback-id="${fb.id}" data-vote-type="up" title="Upvote">
                ${ICON_UPVOTE}
                <span class="vote-count">${voteData.upvotes}</span>
              </button>
              <button class="btn-vote btn-downvote ${hasDownvoted ? 'active' : ''}" data-feedback-id="${fb.id}" data-vote-type="down" title="Downvote">
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
}

export function renderMergedItemsSection(ctx, parentId, children) {
  const isExpanded = ctx.isMergedItemsExpanded(parentId);

  const childrenHtml = children.map(child => {
    const priorityClass = PRIORITY_CLASSES[child.priority] || 'priority-medium';
    return `
      <div class="feedback-merged-card ${priorityClass}" data-child-id="${child.id}">
        <div class="feedback-merged-card-header">
          <span class="feedback-merged-card-date">${formatDateDE(child.created_at)}</span>
          <span class="feedback-merged-card-creator">${safe(child.creator?.name || 'Unbekannt')}</span>
          ${ctx.isAdmin ? `
            <button class="btn-unmerge-feedback" data-child-id="${child.id}" title="Trennen">
              ${ICON_UNMERGE}
            </button>
          ` : ''}
        </div>
        <p class="feedback-merged-card-description">${safe(child.description)}</p>
      </div>
    `;
  }).join('');

  return `
    <div class="feedback-merged-items" data-parent-id="${parentId}">
      <button class="feedback-merged-toggle ${isExpanded ? 'expanded' : ''}" data-parent-id="${parentId}">
        <span class="feedback-merged-toggle-icon">${ICON_CHEVRON_DOWN}</span>
        <span class="feedback-merged-toggle-text">${children.length} zusammengeführte${children.length > 1 ? ' Tickets' : 's Ticket'}</span>
      </button>
      <div class="feedback-merged-list ${isExpanded ? '' : 'hidden'}">
        ${childrenHtml}
      </div>
    </div>
  `;
}

export function renderCommentsSection(ctx, feedbackId, comments, canComment) {
  const commentsHtml = comments.map(c => {
    const date = formatDateDE(c.created_at);
    const canEditComment = c.author_id === window.currentUser?.id;
    const isEditing = ctx.editingCommentId === c.id;
    const authorName = c.author?.name || 'Unbekannt';
    const initials = getInitials(authorName);

    if (isEditing) {
      return `
        <div class="feedback-comment feedback-comment--editing" data-comment-id="${c.id}">
          <div class="comment-header">
            <div class="avatar-bubble avatar-bubble--comment" title="${safe(authorName)}">${initials}</div>
            <span class="comment-meta">${safe(authorName)} • ${date}</span>
          </div>
          <div class="comment-edit-form">
            <textarea class="comment-edit-input" data-comment-id="${c.id}" data-feedback-id="${feedbackId}" rows="1">${safe(c.text)}</textarea>
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

  const isHidden = ctx.isCommentsHidden(feedbackId);

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
            <textarea class="feedback-comment-input" data-feedback-id="${feedbackId}" rows="1" placeholder="Kommentar eingeben..."></textarea>
            <button type="button" class="btn-send-comment" data-feedback-id="${feedbackId}">${ICON_SEND}</button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}
