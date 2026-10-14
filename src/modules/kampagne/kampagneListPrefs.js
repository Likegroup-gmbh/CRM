// Abgeschlossene Kampagnen in der Übersicht verbergen.
// Letzte Wahl pro Nutzer in diesem Browser. Ohne gespeicherte Wahl: alle sichtbar.

const STORAGE_PREFIX = 'kampagne-hide-completed:';

let hideCompleted = false;
let loadedFor;

function userId() {
  return window.currentUser?.id || null;
}

function storageKey(id) {
  return `${STORAGE_PREFIX}${id}`;
}

function readStored(id) {
  try {
    return localStorage.getItem(storageKey(id)) === 'true';
  } catch {
    return false;
  }
}

export function getHideCompleted() {
  const id = userId();
  if (loadedFor !== id) {
    loadedFor = id;
    hideCompleted = id ? readStored(id) : false;
  }
  return hideCompleted;
}

export function setHideCompleted(value) {
  hideCompleted = !!value;
  const id = userId();
  loadedFor = id;
  if (!id) return hideCompleted;
  try {
    localStorage.setItem(storageKey(id), hideCompleted ? 'true' : 'false');
  } catch { /* privat oder voll */ }
  return hideCompleted;
}

export function shouldHideCompleted(searchQuery = '') {
  return getHideCompleted() && !String(searchQuery || '').trim();
}
