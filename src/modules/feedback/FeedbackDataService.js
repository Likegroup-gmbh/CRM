// FeedbackDataService.js
// Supabase-Queries und Mutations fuer das Feedback-Modul

import { EFFORT_LABELS } from './FeedbackConstants.js';

const SUPABASE = () => window.supabase;

const FEEDBACK_SELECT = `
  *,
  creator:created_by(id, name)
`;

// === Loading ===

export async function loadFeedbacks(ctx) {
  if (!SUPABASE()) {
    ctx.feedbacks = [];
    ctx.childFeedbacks = {};
    return;
  }

  let query = SUPABASE()
    .from('feedback')
    .select(FEEDBACK_SELECT)
    .is('parent_id', null)
    .order('created_at', { ascending: false });

  if (ctx.filters.priority) {
    query = query.eq('priority', ctx.filters.priority);
  }
  if (ctx.filters.area) {
    query = query.eq('area', ctx.filters.area);
  }
  if (ctx.filters.creator) {
    query = query.eq('created_by', ctx.filters.creator);
  }
  if (ctx.filters.date) {
    query = query
      .gte('created_at', `${ctx.filters.date}T00:00:00`)
      .lte('created_at', `${ctx.filters.date}T23:59:59.999`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Fehler beim Laden der Feedbacks:', error);
    ctx.feedbacks = [];
  } else {
    ctx.feedbacks = data || [];
  }

  await loadChildFeedbacks(ctx);
}

export async function loadChildFeedbacks(ctx) {
  if (!SUPABASE()) {
    ctx.childFeedbacks = {};
    return;
  }

  const { data, error } = await SUPABASE()
    .from('feedback')
    .select(FEEDBACK_SELECT)
    .not('parent_id', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fehler beim Laden der Child-Feedbacks:', error);
    ctx.childFeedbacks = {};
    return;
  }

  ctx.childFeedbacks = {};
  (data || []).forEach(child => {
    if (!ctx.childFeedbacks[child.parent_id]) {
      ctx.childFeedbacks[child.parent_id] = [];
    }
    ctx.childFeedbacks[child.parent_id].push(child);
  });
}

export async function loadComments(ctx) {
  if (!SUPABASE() || ctx.feedbacks.length === 0) {
    ctx.comments = {};
    return;
  }

  const feedbackIds = ctx.feedbacks.map(f => f.id);

  const { data, error } = await SUPABASE()
    .from('feedback_comments')
    .select(`*, author:author_id(id, name)`)
    .in('feedback_id', feedbackIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Fehler beim Laden der Kommentare:', error);
    ctx.comments = {};
    return;
  }

  ctx.comments = {};
  (data || []).forEach(comment => {
    if (!ctx.comments[comment.feedback_id]) {
      ctx.comments[comment.feedback_id] = [];
    }
    ctx.comments[comment.feedback_id].push(comment);
  });
}

export async function loadVotes(ctx) {
  if (!SUPABASE() || ctx.feedbacks.length === 0) {
    ctx.votes = {};
    return;
  }

  const feedbackIds = ctx.feedbacks.map(f => f.id);
  const currentUserId = window.currentUser?.id;

  const { data, error } = await SUPABASE()
    .from('feedback_votes')
    .select('*')
    .in('feedback_id', feedbackIds);

  if (error) {
    console.error('Fehler beim Laden der Votes:', error);
    ctx.votes = {};
    return;
  }

  ctx.votes = {};
  feedbackIds.forEach(id => {
    ctx.votes[id] = { upvotes: 0, downvotes: 0, userVote: null };
  });

  (data || []).forEach(vote => {
    if (!ctx.votes[vote.feedback_id]) {
      ctx.votes[vote.feedback_id] = { upvotes: 0, downvotes: 0, userVote: null };
    }
    if (vote.vote_type === 'up') ctx.votes[vote.feedback_id].upvotes++;
    else if (vote.vote_type === 'down') ctx.votes[vote.feedback_id].downvotes++;
    if (vote.user_id === currentUserId) {
      ctx.votes[vote.feedback_id].userVote = vote.vote_type;
    }
  });
}

export async function loadCreators(ctx) {
  if (!SUPABASE()) {
    ctx.creators = [];
    return;
  }

  const { data, error } = await SUPABASE()
    .from('feedback')
    .select('created_by, creator:created_by(id, name)')
    .not('created_by', 'is', null);

  if (error) {
    console.error('Fehler beim Laden der Creator:', error);
    ctx.creators = [];
    return;
  }

  const seen = new Set();
  ctx.creators = (data || [])
    .filter(row => {
      if (!row.creator?.id || seen.has(row.creator.id)) return false;
      seen.add(row.creator.id);
      return true;
    })
    .map(row => ({ id: row.creator.id, name: row.creator.name || 'Unbekannt' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

// === Mutations ===

export async function addComment(ctx, feedbackId, text) {
  if (!SUPABASE()) return;

  const { data, error } = await SUPABASE()
    .from('feedback_comments')
    .insert({ feedback_id: feedbackId, text, author_id: window.currentUser?.id })
    .select(`*, author:author_id(id, name)`)
    .single();

  if (error) {
    console.error('Fehler beim Speichern des Kommentars:', error);
    window.toastSystem?.show('Fehler beim Speichern', 'error');
    return;
  }

  if (!ctx.comments[feedbackId]) ctx.comments[feedbackId] = [];
  ctx.comments[feedbackId].push(data);
  window.toastSystem?.show('Kommentar hinzugefügt', 'success');

  ctx.rerenderCard(feedbackId);
}

export async function saveEditComment(ctx, commentId, feedbackId, newText) {
  if (!newText.trim()) {
    window.toastSystem?.show('Kommentar darf nicht leer sein', 'warning');
    return;
  }

  const { error } = await SUPABASE()
    .from('feedback_comments')
    .update({ text: newText.trim() })
    .eq('id', commentId);

  if (error) {
    console.error('Fehler beim Speichern:', error);
    window.toastSystem?.show('Fehler beim Speichern', 'error');
    return;
  }

  const feedbackComments = ctx.comments[feedbackId];
  if (feedbackComments) {
    const comment = feedbackComments.find(c => c.id === commentId);
    if (comment) comment.text = newText.trim();
  }

  ctx.editingCommentId = null;
  window.toastSystem?.show('Kommentar aktualisiert', 'success');
  ctx.rerenderCard(feedbackId);
}

export async function deleteComment(ctx, commentId, feedbackId) {
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

  const { error } = await SUPABASE()
    .from('feedback_comments')
    .delete()
    .eq('id', commentId);

  if (error) {
    console.error('Fehler beim Löschen:', error);
    window.toastSystem?.show('Fehler beim Löschen', 'error');
    return;
  }

  if (ctx.comments[feedbackId]) {
    ctx.comments[feedbackId] = ctx.comments[feedbackId].filter(c => c.id !== commentId);
  }
  window.toastSystem?.show('Kommentar gelöscht', 'success');
  ctx.rerenderCard(feedbackId);
}

export async function deleteFeedback(ctx, feedbackId) {
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

  const { error } = await SUPABASE()
    .from('feedback')
    .delete()
    .eq('id', feedbackId)
    .eq('created_by', window.currentUser?.id);

  if (error) {
    console.error('Fehler beim Löschen:', error);
    window.toastSystem?.show('Fehler beim Löschen', 'error');
    return;
  }

  window.toastSystem?.show('Feedback gelöscht', 'success');
  await ctx.refresh();
}

export async function updateFeedbackEffort(ctx, feedbackId, effort) {
  if (!SUPABASE()) return;

  const { error } = await SUPABASE()
    .from('feedback')
    .update({ effort: effort || null })
    .eq('id', feedbackId);

  if (error) {
    console.error('Fehler beim Aktualisieren des Aufwands:', error);
    window.toastSystem?.show('Fehler beim Speichern', 'error');
    return;
  }

  const fb = ctx.feedbacks.find(f => f.id === feedbackId);
  if (fb) fb.effort = effort || null;

  const label = effort ? EFFORT_LABELS[effort] : 'kein';
  window.toastSystem?.show(`Aufwand auf "${label}" gesetzt`, 'success');
}

export async function archiveFeedback(ctx, feedbackId) {
  if (!SUPABASE()) return;

  const fb = ctx.feedbacks.find(f => f.id === feedbackId);
  if (!fb) return;

  const newArchivedState = !fb.archived;

  const { error } = await SUPABASE()
    .from('feedback')
    .update({ archived: newArchivedState })
    .eq('id', feedbackId);

  if (error) {
    console.error('Fehler beim Archivieren:', error);
    window.toastSystem?.show('Fehler beim Archivieren', 'error');
    return;
  }

  fb.archived = newArchivedState;
  window.toastSystem?.show(
    newArchivedState ? 'Feedback archiviert' : 'Archivierung aufgehoben',
    'success'
  );
  ctx.render();
  ctx.bindEvents();
}

export async function handleVote(ctx, feedbackId, voteType) {
  if (!SUPABASE() || !window.currentUser?.id) return;

  const currentVote = ctx.votes[feedbackId]?.userVote;

  if (currentVote === voteType) {
    const { error } = await SUPABASE()
      .from('feedback_votes')
      .delete()
      .eq('feedback_id', feedbackId)
      .eq('user_id', window.currentUser.id);
    if (error) { console.error('Fehler beim Entfernen des Votes:', error); return; }

    if (voteType === 'up') ctx.votes[feedbackId].upvotes--;
    else ctx.votes[feedbackId].downvotes--;
    ctx.votes[feedbackId].userVote = null;
  } else if (currentVote) {
    const { error } = await SUPABASE()
      .from('feedback_votes')
      .update({ vote_type: voteType })
      .eq('feedback_id', feedbackId)
      .eq('user_id', window.currentUser.id);
    if (error) { console.error('Fehler beim Ändern des Votes:', error); return; }

    if (currentVote === 'up') { ctx.votes[feedbackId].upvotes--; ctx.votes[feedbackId].downvotes++; }
    else { ctx.votes[feedbackId].downvotes--; ctx.votes[feedbackId].upvotes++; }
    ctx.votes[feedbackId].userVote = voteType;
  } else {
    const { error } = await SUPABASE()
      .from('feedback_votes')
      .insert({ feedback_id: feedbackId, user_id: window.currentUser.id, vote_type: voteType });
    if (error) { console.error('Fehler beim Speichern des Votes:', error); return; }

    if (!ctx.votes[feedbackId]) ctx.votes[feedbackId] = { upvotes: 0, downvotes: 0, userVote: null };
    if (voteType === 'up') ctx.votes[feedbackId].upvotes++;
    else ctx.votes[feedbackId].downvotes++;
    ctx.votes[feedbackId].userVote = voteType;
  }

  ctx.rerenderCard(feedbackId);
}

export async function mergeFeedback(ctx, childId, parentId) {
  if (!SUPABASE()) return;

  if (ctx.childFeedbacks[childId] && ctx.childFeedbacks[childId].length > 0) {
    window.toastSystem?.show('Diese Card hat selbst zusammengeführte Items und kann nicht zusammengeführt werden', 'warning');
    return;
  }

  const { error } = await SUPABASE()
    .from('feedback')
    .update({ parent_id: parentId })
    .eq('id', childId);

  if (error) {
    console.error('Fehler beim Zusammenführen:', error);
    window.toastSystem?.show('Fehler beim Zusammenführen', 'error');
    return;
  }

  window.toastSystem?.show('Feedbacks zusammengeführt', 'success');
  await ctx.refresh();
}

export async function unmergeFeedback(ctx, childId) {
  if (!SUPABASE()) return;

  const { error } = await SUPABASE()
    .from('feedback')
    .update({ parent_id: null })
    .eq('id', childId);

  if (error) {
    console.error('Fehler beim Trennen:', error);
    window.toastSystem?.show('Fehler beim Trennen', 'error');
    return;
  }

  window.toastSystem?.show('Feedback getrennt', 'success');
  await ctx.refresh();
}

export async function moveFeedback(ctx, feedbackId, newCategory, newStatus) {
  const { error } = await SUPABASE()
    .from('feedback')
    .update({ category: newCategory, status: newStatus })
    .eq('id', feedbackId);

  if (error) {
    console.error('Fehler beim Verschieben:', error);
    window.toastSystem?.show('Fehler beim Verschieben', 'error');
    return false;
  }

  return true;
}
