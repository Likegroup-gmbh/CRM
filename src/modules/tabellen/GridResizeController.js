// GridResizeController.js
// Handles column width and row height resizing

export class GridResizeController {
  constructor(renderer, onResize) {
    this.renderer = renderer;
    this.onResize = onResize; // Callback zum Speichern
    this.isResizing = false;
    this.resizeType = null; // 'col' oder 'row'
    this.resizeIndex = null;
    this.startPos = 0;
    this.startSize = 0;
  }

  init() {
    this.bindResizeEvents();
  }

  bindResizeEvents() {
    const container = this.renderer.container;

    // Mousedown auf Resize-Handles
    container.addEventListener('mousedown', (e) => {
      const colHandle = e.target.closest('.resize-handle-col');
      const rowHandle = e.target.closest('.resize-handle-row');

      if (colHandle) {
        this.startResize('col', parseInt(colHandle.dataset.col), e.pageX);
        e.preventDefault();
      } else if (rowHandle) {
        this.startResize('row', parseInt(rowHandle.dataset.row), e.pageY);
        e.preventDefault();
      }
    });

    // Mousemove
    document.addEventListener('mousemove', (e) => {
      if (!this.isResizing) return;

      const delta = (this.resizeType === 'col' ? e.pageX : e.pageY) - this.startPos;
      const newSize = Math.max(50, this.startSize + delta); // Min 50px

      if (this.resizeType === 'col') {
        this.renderer.setColumnWidth(this.resizeIndex, newSize);
      } else {
        this.renderer.setRowHeight(this.resizeIndex, newSize);
      }
    });

    // Mouseup
    document.addEventListener('mouseup', () => {
      if (this.isResizing) {
        this.endResize();
      }
    });
  }

  startResize(type, index, pos) {
    this.isResizing = true;
    this.resizeType = type;
    this.resizeIndex = index;
    this.startPos = pos;

    if (type === 'col') {
      this.startSize = this.renderer.columnWidths.get(index) || 120;
    } else {
      this.startSize = this.renderer.rowHeights.get(index) || 32;
    }

    document.body.style.cursor = type === 'col' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }

  endResize() {
    this.isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Callback zum Speichern
    if (this.onResize) {
      this.onResize();
    }
  }

  destroy() {
    // Cleanup falls nötig
  }
}




