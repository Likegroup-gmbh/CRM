// Ziehen an einem Griff, wie im Drawer "Tabelle anpassen".
// Nur der Griff macht die Zeile ziehbar. onCommit läuft nach dem Loslassen.

export function bindGripReorder(list, { rowSelector, handleSelector, onCommit }) {
  if (!list) return () => {};
  const cleanups = [];
  let dragged = null;
  const rows = () => list.querySelectorAll(rowSelector);

  list.querySelectorAll(handleSelector).forEach(handle => {
    const onMouseDown = () => {
      handle.closest(rowSelector)?.setAttribute('draggable', 'true');
    };
    handle.addEventListener('mousedown', onMouseDown);
    cleanups.push(() => handle.removeEventListener('mousedown', onMouseDown));
  });

  const onMouseUp = () => {
    rows().forEach(row => row.setAttribute('draggable', 'false'));
  };
  document.addEventListener('mouseup', onMouseUp);
  cleanups.push(() => document.removeEventListener('mouseup', onMouseUp));

  rows().forEach(row => {
    const onDragStart = (event) => {
      dragged = row;
      row.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        try {
          event.dataTransfer.setData('text/plain', row.dataset.column || row.dataset.optionId || row.dataset.draftLabel || '');
        } catch { /* jsdom */ }
      }
    };
    const onDragEnd = async () => {
      row.classList.remove('is-dragging');
      row.setAttribute('draggable', 'false');
      dragged = null;
      list.querySelectorAll(`${rowSelector}.drag-over`).forEach(el => el.classList.remove('drag-over'));
      if (onCommit) await onCommit();
    };
    const onDragOver = (event) => {
      event.preventDefault();
      if (!dragged || dragged === row) return;
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      const siblings = Array.from(list.children);
      const from = siblings.indexOf(dragged);
      const to = siblings.indexOf(row);
      if (from < 0 || to < 0) return;
      list.insertBefore(dragged, from < to ? row.nextSibling : row);
    };
    const onDrop = (event) => event.preventDefault();

    row.addEventListener('dragstart', onDragStart);
    row.addEventListener('dragend', onDragEnd);
    row.addEventListener('dragover', onDragOver);
    row.addEventListener('drop', onDrop);
    cleanups.push(() => {
      row.removeEventListener('dragstart', onDragStart);
      row.removeEventListener('dragend', onDragEnd);
      row.removeEventListener('dragover', onDragOver);
      row.removeEventListener('drop', onDrop);
    });
  });

  return () => {
    cleanups.forEach(fn => fn());
    dragged = null;
  };
}
