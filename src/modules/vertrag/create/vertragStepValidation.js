// Pflichtfeld-Check fuer den Vertrag-Wizard: nur sichtbare, aktive Felder.

export function isFieldInvisible(field) {
  if (!field) return true;
  if (field.closest('.hidden')) return true;

  let node = field;
  while (node && node !== document.documentElement) {
    if (node.style?.display === 'none') return true;
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      if (window.getComputedStyle(node).display === 'none') return true;
    }
    node = node.parentElement;
  }
  return false;
}

export function isRequiredFieldMissing(field) {
  if (!field || field.disabled || isFieldInvisible(field)) return false;
  return (field.value ?? '').toString().trim() === '';
}

export function missingRequiredFields(form) {
  if (!form) return [];
  return Array.from(form.querySelectorAll('[required]')).filter(isRequiredFieldMissing);
}
