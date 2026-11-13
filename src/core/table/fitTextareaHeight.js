// Hoehe einer Textarea an den Inhalt ziehen, wenn field-sizing:content fehlt
// (Safari vor 26.2, Firefox vor 152). Mit field-sizing uebernimmt das CSS das.

const TEXT_SELECTOR = 'textarea.custom-col-text, td.entity-custom-col--text textarea';

function fieldSizingSupported() {
  try {
    return globalThis.CSS?.supports?.('field-sizing', 'content') === true;
  } catch {
    return false;
  }
}

export function fitTextareaHeight(textarea) {
  if (!textarea || fieldSizingSupported()) return;
  textarea.style.height = 'auto';
  const next = textarea.scrollHeight;
  if (next > 0) textarea.style.height = `${next}px`;
}

export function fitCustomTextareas(root) {
  if (!root || fieldSizingSupported()) return;
  root.querySelectorAll(TEXT_SELECTOR).forEach(fitTextareaHeight);
}

/** Nach Render, beim Tippen und beim Viewport-Resize die Texthoehe nachziehen. */
export function bindWrappingTextareas(root, addCleanup) {
  if (!root || typeof addCleanup !== 'function') return;
  const fit = () => fitCustomTextareas(root);
  fit();
  const onInput = (e) => {
    const textarea = e.target;
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    if (!textarea.closest('td.entity-custom-col--text, td.col-custom-text')) return;
    fitTextareaHeight(textarea);
  };
  root.addEventListener('input', onInput);
  window.addEventListener('resize', fit);
  addCleanup(() => {
    root.removeEventListener('input', onInput);
    window.removeEventListener('resize', fit);
  });
}
