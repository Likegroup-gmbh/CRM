// Session-Flag: abgeschlossene Kampagnen auf der Liste anzeigen.
// Lebt so lange wie das Modul (SPA-Navigation), stirbt beim Reload.

let showCompleted = false;

export function getShowCompleted() {
  return showCompleted;
}

export function setShowCompleted(value) {
  showCompleted = !!value;
  return showCompleted;
}

export function shouldHideCompleted(searchQuery = '') {
  return !showCompleted && !String(searchQuery || '').trim();
}
