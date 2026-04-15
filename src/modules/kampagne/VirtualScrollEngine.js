// VirtualScrollEngine.js
// Virtual Scrolling für variable Zeilenhöhen.
// Rendert nur sichtbare Zeilen + Buffer in einem Scroll-Container.

export class VirtualScrollEngine {
  constructor({
    container,
    totalItems,
    estimateHeight,
    renderItem,
    bufferCount = 5,
    onVisibleRangeChange = null
  }) {
    this.container = container;
    this.totalItems = totalItems;
    this.estimateHeight = estimateHeight;
    this.renderItem = renderItem;
    this.bufferCount = bufferCount;
    this.onVisibleRangeChange = onVisibleRangeChange;

    this._measuredHeights = new Map();
    this._offsets = [];
    this._totalHeight = 0;
    this._renderedRange = { start: -1, end: -1 };
    this._scrollRAF = null;
    this._resizeObserver = null;

    this._spacerTop = null;
    this._spacerBottom = null;
    this._rowContainer = null;

    this._scrollHandler = this._onScroll.bind(this);
  }

  mount() {
    this.container.style.overflowY = 'auto';
    this.container.style.position = 'relative';

    this._spacerTop = document.createElement('div');
    this._spacerTop.className = 'vs-spacer-top';
    this._spacerTop.style.width = '100%';

    this._rowContainer = document.createElement('div');
    this._rowContainer.className = 'vs-row-container';

    this._spacerBottom = document.createElement('div');
    this._spacerBottom.className = 'vs-spacer-bottom';
    this._spacerBottom.style.width = '100%';

    this.container.appendChild(this._spacerTop);
    this.container.appendChild(this._rowContainer);
    this.container.appendChild(this._spacerBottom);

    this._recalcOffsets();
    this.container.addEventListener('scroll', this._scrollHandler, { passive: true });

    this._resizeObserver = new ResizeObserver(() => {
      this._measureRenderedRows();
      this._recalcOffsets();
      this._updateDOM();
    });
    this._resizeObserver.observe(this.container);

    this._updateDOM();
  }

  updateItems(newTotal) {
    this.totalItems = newTotal;
    this._measuredHeights.clear();
    this._renderedRange = { start: -1, end: -1 };
    this._recalcOffsets();
    this._updateDOM();
  }

  scrollToTop() {
    if (this.container) this.container.scrollTop = 0;
  }

  refreshRow(index) {
    const { start, end } = this._renderedRange;
    if (index < start || index >= end) return;

    const relativeIndex = index - start;
    const rows = this._rowContainer.children;
    if (relativeIndex < 0 || relativeIndex >= rows.length) return;

    const html = this.renderItem(index);
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const newRow = temp.firstElementChild;
    if (newRow && rows[relativeIndex]) {
      rows[relativeIndex].replaceWith(newRow);
      this._measureRenderedRows();
    }
  }

  destroy() {
    if (this._scrollRAF) cancelAnimationFrame(this._scrollRAF);
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this.container?.removeEventListener('scroll', this._scrollHandler);
    this._measuredHeights.clear();
  }

  // ========================================
  // INTERNALS
  // ========================================

  _recalcOffsets() {
    this._offsets = new Array(this.totalItems);
    let cumulative = 0;
    for (let i = 0; i < this.totalItems; i++) {
      this._offsets[i] = cumulative;
      cumulative += this._getHeight(i);
    }
    this._totalHeight = cumulative;
  }

  _getHeight(index) {
    if (this._measuredHeights.has(index)) return this._measuredHeights.get(index);
    return this.estimateHeight(index);
  }

  _onScroll() {
    if (this._scrollRAF) return;
    this._scrollRAF = requestAnimationFrame(() => {
      this._scrollRAF = null;
      this._updateDOM();
    });
  }

  _updateDOM() {
    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;

    let startIdx = this._findStartIndex(scrollTop);
    let endIdx = this._findEndIndex(scrollTop + viewportHeight);

    const bufferedStart = Math.max(0, startIdx - this.bufferCount);
    const bufferedEnd = Math.min(this.totalItems, endIdx + this.bufferCount);

    if (bufferedStart === this._renderedRange.start && bufferedEnd === this._renderedRange.end) {
      return;
    }

    this._renderedRange = { start: bufferedStart, end: bufferedEnd };

    const topSpace = this._offsets[bufferedStart] || 0;
    const bottomOffset = bufferedEnd < this.totalItems
      ? this._totalHeight - (this._offsets[bufferedEnd] || this._totalHeight)
      : 0;

    this._spacerTop.style.height = `${topSpace}px`;
    this._spacerBottom.style.height = `${Math.max(0, bottomOffset)}px`;

    const fragment = document.createDocumentFragment();
    for (let i = bufferedStart; i < bufferedEnd; i++) {
      const html = this.renderItem(i);
      const temp = document.createElement('template');
      temp.innerHTML = html;
      const node = temp.content.firstElementChild;
      if (node) {
        node.dataset.vsIndex = i;
        fragment.appendChild(node);
      }
    }
    this._rowContainer.innerHTML = '';
    this._rowContainer.appendChild(fragment);

    requestAnimationFrame(() => {
      this._measureRenderedRows();
      const prevTotal = this._totalHeight;
      this._recalcOffsets();
      if (Math.abs(this._totalHeight - prevTotal) > 2) {
        const topSpaceNew = this._offsets[bufferedStart] || 0;
        const bottomOffsetNew = bufferedEnd < this.totalItems
          ? this._totalHeight - (this._offsets[bufferedEnd] || this._totalHeight)
          : 0;
        this._spacerTop.style.height = `${topSpaceNew}px`;
        this._spacerBottom.style.height = `${Math.max(0, bottomOffsetNew)}px`;
      }
    });

    if (this.onVisibleRangeChange) {
      this.onVisibleRangeChange(startIdx, endIdx);
    }
  }

  _measureRenderedRows() {
    const rows = this._rowContainer.children;
    for (const row of rows) {
      const idx = parseInt(row.dataset.vsIndex, 10);
      if (!isNaN(idx)) {
        const h = row.getBoundingClientRect().height;
        if (h > 0) this._measuredHeights.set(idx, h);
      }
    }
  }

  _findStartIndex(scrollTop) {
    let lo = 0, hi = this.totalItems - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const offset = this._offsets[mid] || 0;
      const height = this._getHeight(mid);
      if (offset + height <= scrollTop) lo = mid + 1;
      else hi = mid - 1;
    }
    return Math.min(lo, this.totalItems - 1);
  }

  _findEndIndex(scrollBottom) {
    let lo = 0, hi = this.totalItems - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const offset = this._offsets[mid] || 0;
      if (offset < scrollBottom) lo = mid + 1;
      else hi = mid - 1;
    }
    return Math.min(lo, this.totalItems);
  }
}
