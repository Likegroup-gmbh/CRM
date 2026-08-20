// GridFiller.js
// Füllt leere auto-fill-Tracks in .folders-grid mit unsichtbaren Zellen,
// damit der Grid-Background (Border-Hack) nicht durchscheint.

export function fillFoldersGrid(grid) {
  if (!grid) return;
  grid.querySelectorAll('.grid-filler').forEach(el => el.remove());
  const cards = grid.querySelectorAll('.folder-card');
  if (cards.length === 0) return;
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  const remainder = cards.length % cols;
  if (remainder === 0) return;
  const fillerCount = cols - remainder;
  for (let i = 0; i < fillerCount; i++) {
    const filler = document.createElement('div');
    filler.className = 'grid-filler';
    filler.setAttribute('aria-hidden', 'true');
    grid.appendChild(filler);
  }
}
