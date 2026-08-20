// FeedbackConstants.js
// Icons fuer das Feedback-Modul. Alle gehen ueber das zentrale IconSystem.

import { icon } from '../../core/icons/IconSystem.js';

export const ICON_BUG = icon('bug', { stroke: 1.5 });
export const ICON_FEATURE = icon('sparkles', { stroke: 1.5 });
export const ICON_DONE = icon('check', { stroke: 1.5 });
export const ICON_IN_PROGRESS = icon('wrench', { stroke: 1.5 });
export const ICON_ADDITIONS = icon('folder-plus', { stroke: 1.5 });
export const ICON_BACKLOG = icon('archive-box', { stroke: 1.5 });

export const ICON_ARCHIVE = icon('archive-box', { stroke: 1.5 });
export const ICON_UNARCHIVE = icon('archive-box-arrow', { stroke: 1.5 });
export const ICON_DELETE = icon('trash', { stroke: 1.5 });
export const ICON_EDIT = icon('cog', { stroke: 1.5 });
export const ICON_SEND = icon('paper-airplane', { stroke: 1.5 });

export const ICON_EDIT_SMALL = icon('cog', { stroke: 1.5, className: 'icon-12' });
export const ICON_DELETE_SMALL = icon('trash', { stroke: 1.5, className: 'icon-12' });

export const ICON_COMMENT = icon('chat-bubble-left-ellipsis', { stroke: 1.5 });
export const ICON_UPVOTE = icon('hand-thumb-up', { stroke: 1.5 });
export const ICON_DOWNVOTE = icon('hand-thumb-down', { stroke: 1.5 });
export const ICON_MERGE = icon('arrows-right-left', { stroke: 1.5 });
export const ICON_UNMERGE = icon('arrows-expand-diagonal', { stroke: 1.5 });
export const ICON_CHEVRON_DOWN = icon('chevron-down', { stroke: 1.5 });

export const ICON_BUG_SM = icon('bug', { stroke: 1.5, className: 'icon-16' });
export const ICON_FEATURE_SM = icon('sparkles', { stroke: 1.5, className: 'icon-16' });
export const ICON_ADDITIONS_SM = icon('folder-plus', { stroke: 1.5, className: 'icon-16' });

// === Shared Data Maps ===
export const FEEDBACK_AREAS = [
  { value: '', label: '-- Kein Bereich --' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'aufgaben', label: 'Aufgaben' },
  { value: 'unternehmen', label: 'Unternehmen' },
  { value: 'marken', label: 'Marken' },
  { value: 'ansprechpartner', label: 'Ansprechpartner' },
  { value: 'creator', label: 'Creator' },
  { value: 'auftraege', label: 'Aufträge' },
  { value: 'auftragsdetails', label: 'Auftragsdetails' },
  { value: 'kampagnen', label: 'Kampagnen' },
  { value: 'strategie', label: 'Strategie' },
  { value: 'creator-sourcing', label: 'Sourcing' },
  { value: 'vertraege', label: 'Verträge' },
  { value: 'briefing', label: 'Briefing' },
  { value: 'videos', label: 'Videos' },
  { value: 'rechnung', label: 'Rechnung' },
  { value: 'mitarbeiter', label: 'Mitarbeiter' },
  { value: 'sonstiges', label: 'Sonstiges' }
];
export const AREA_LABELS = Object.fromEntries(
  FEEDBACK_AREAS.filter(a => a.value).map(a => [a.value, a.label])
);
export const PRIORITY_CLASSES = { low: 'priority-low', medium: 'priority-medium', high: 'priority-high' };
export const PRIORITY_LABELS = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch' };
export const EFFORT_LABELS = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch' };
export const STATUS_LABELS = {
  closed: 'Erledigt',
  in_progress: 'In Bearbeitung',
  additions: 'Ergänzungen',
  backlog: 'Backlog/Hold'
};
export function safe(str) {
  return window.validatorSystem?.sanitizeHtml?.(str) ?? str;
}
export function formatDateDE(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}
