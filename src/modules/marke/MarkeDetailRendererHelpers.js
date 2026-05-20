// MarkeDetailRendererHelpers.js
// Kleine wiederverwendbare Render-Helfer

export function getBranchenDisplay(detail) {
  if (!detail.marke?.branchen || detail.marke.branchen.length === 0) return '-';
  return detail.marke.branchen.filter(b => b && b.name).map(b => b.name).join(', ');
}

export function renderBranchenTags(detail) {
  if (!detail.marke?.branchen || detail.marke.branchen.length === 0) {
    return '-';
  }
  return detail.marke.branchen
    .filter(branche => branche && branche.name)
    .map(branche => `<span class="tag tag--branche">${detail.sanitize(branche.name)}</span>`)
    .join(' ');
}
