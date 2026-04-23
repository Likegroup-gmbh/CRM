// VideoTableUIHelpers.js
// UI-Helpers fuer die Kampagnen-Video-Tabelle:
// Floating Scrollbar, Spalten-Resize, Drag-to-Scroll, Performance-Tracking

export class VideoTableUIHelpers {
  constructor(table) {
    this.table = table;
    this._resizeAbort = null;
    this._scrollbarAbort = null;
    this._dragScrollAbort = null;
  }

  // --- Performance Tracking ---

  startPerformanceTracking(stageName) {
    const ts = performance.now();
    this.table.performanceMetrics.stages[stageName] = {
      start: ts, end: null, duration: null, status: 'running'
    };
    return ts;
  }

  endPerformanceTracking(stageName, success = true, error = null) {
    const ts = performance.now();
    const stage = this.table.performanceMetrics.stages[stageName];
    if (stage) {
      stage.end = ts;
      stage.duration = ts - stage.start;
      stage.status = success ? 'success' : 'failed';
      if (error) {
        stage.error = error;
        this.table.performanceMetrics.errors.push({ stage: stageName, error });
      }
    }
    return ts;
  }

  logPerformanceSummary() {
    const totalTime = performance.now() - this.table.performanceMetrics.startTime;

    console.group(
      `%c⚡ Performance-Report: Kooperationen-Video-Tabelle (${totalTime.toFixed(0)}ms)`,
      'background: #2563eb; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;'
    );

    const stageEntries = Object.entries(this.table.performanceMetrics.stages)
      .sort((a, b) => (b[1].duration || 0) - (a[1].duration || 0));

    stageEntries.forEach(([name, metrics]) => {
      const icon = metrics.status === 'success' ? '✅' : metrics.status === 'failed' ? '❌' : '⏳';
      const percent = ((metrics.duration / totalTime) * 100).toFixed(1);
      const color = metrics.status === 'failed' ? '#ef4444' : metrics.duration > 1000 ? '#f59e0b' : '#10b981';
      console.log(
        `${icon} %c${name}%c ${metrics.duration?.toFixed(0)}ms %c(${percent}%)`,
        `color: ${color}; font-weight: bold;`, 'color: inherit;', 'color: #6b7280; font-size: 0.9em;'
      );
      if (metrics.error) console.error('  └─ Error:', metrics.error);
    });

    if (this.table.performanceMetrics.errors.length > 0) {
      console.group('%c⚠️ Fehler-Details', 'color: #ef4444; font-weight: bold;');
      this.table.performanceMetrics.errors.forEach(({ stage, error }) => console.error(`${stage}:`, error));
      console.groupEnd();
    }

    console.group('%c📊 Geladene Daten', 'color: #6366f1; font-weight: bold;');
    console.log('Kooperationen:', this.table.kooperationen.length);
    console.log('Videos:', Object.values(this.table.videos).flat().length);
    console.log('Creators:', this.table.creators.size);
    console.log('Comments:', Object.keys(this.table.videoComments).length);
    console.log('Versand-Infos:', Object.keys(this.table.versandInfos).length);
    console.groupEnd();

    const prev = this._getPreviousPerformance();
    if (prev) {
      const diff = totalTime - prev.totalTime;
      const pct = ((diff / prev.totalTime) * 100).toFixed(1);
      console.log(`${diff > 0 ? '🔴' : '🟢'} Vergleich: ${diff > 0 ? '+' : ''}${diff.toFixed(0)}ms (${pct}%)`);
    }
    this._savePerformanceMetrics(totalTime);

    console.groupEnd();
  }

  _getPreviousPerformance() {
    try {
      const key = `perf_koops_videos_${this.table.kampagneId}`;
      const history = JSON.parse(localStorage.getItem(key) || '[]');
      return history.length > 0 ? history[history.length - 1] : null;
    } catch { return null; }
  }

  _savePerformanceMetrics(totalTime) {
    try {
      const key = `perf_koops_videos_${this.table.kampagneId}`;
      const history = JSON.parse(localStorage.getItem(key) || '[]');
      history.push({
        timestamp: new Date().toISOString(),
        totalTime,
        stages: this.table.performanceMetrics.stages,
        errorCount: this.table.performanceMetrics.errors.length,
        dataSize: {
          kooperationen: this.table.kooperationen.length,
          videos: Object.values(this.table.videos).flat().length,
          creators: this.table.creators.size
        }
      });
      if (history.length > 20) history.shift();
      localStorage.setItem(key, JSON.stringify(history));
    } catch { /* localStorage voll */ }
  }

  // --- Loading Progress ---

  updateLoadingProgress(message, percent) {
    const container = document.getElementById(this.table.containerId);
    if (!container) return;

    let progressBar = container.querySelector('.koops-videos-progress');
    if (!progressBar) {
      progressBar = document.createElement('div');
      progressBar.className = 'koops-videos-progress';
      progressBar.style.cssText = 'position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#2563eb,#3b82f6);transition:width 0.3s ease;z-index:100;';
      container.style.position = 'relative';
      container.appendChild(progressBar);
    }
    progressBar.style.width = `${percent}%`;

    let msgEl = container.querySelector('.koops-videos-loading-msg');
    if (!msgEl) {
      msgEl = document.createElement('div');
      msgEl.className = 'koops-videos-loading-msg';
      msgEl.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:16px 24px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);z-index:101;font-size:14px;color:#374151;';
      container.appendChild(msgEl);
    }
    msgEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:20px;height:20px;border:2px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
        <div><div style="font-weight:600;">${message}</div><div style="font-size:12px;color:#6b7280;margin-top:4px;">${percent}%</div></div>
      </div>`;
  }

  removeLoadingProgress() {
    const container = document.getElementById(this.table.containerId);
    if (!container) return;
    container.querySelector('.koops-videos-progress')?.remove();
    container.querySelector('.koops-videos-loading-msg')?.remove();
  }

  // --- Column Resize ---

  bindResizeEvents() {
    const container = document.querySelector('.grid-wrapper');
    if (!container) return;

    this._resizeAbort?.abort();
    this._resizeAbort = new AbortController();
    const signal = this._resizeAbort.signal;

    container.addEventListener('mousedown', (e) => {
      const handle = e.target.closest('.resize-handle-col');
      if (handle) {
        this.startResize(parseInt(handle.dataset.col), e.pageX);
        e.preventDefault();
      }
    }, { signal });

    document.addEventListener('mousemove', (e) => {
      if (!this.table.isResizing) return;
      const delta = e.pageX - this.table.resizeStartX;
      const newWidth = Math.max(50, this.table.resizeStartWidth + delta);
      this.setColumnWidth(this.table.resizeCol, newWidth);
    }, { signal });

    document.addEventListener('mouseup', () => {
      if (this.table.isResizing) this.endResize();
    }, { signal });
  }

  startResize(col, pageX) {
    this.table.isResizing = true;
    this.table.resizeCol = col;
    this.table.resizeStartX = pageX;
    const header = document.querySelector(`.col-header .resize-handle-col[data-col="${col}"]`)?.closest('.col-header');
    this.table.resizeStartWidth = header ? header.offsetWidth : 120;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  setColumnWidth(col, width) {
    this.table.columnWidths.set(col, width);

    document.querySelectorAll(`th.col-header:nth-child(${col + 1})`).forEach(h => {
      h.style.width = `${width}px`;
      h.style.minWidth = `${width}px`;
    });
    document.querySelectorAll(`.kooperation-video-grid tbody td:nth-child(${col + 1})`).forEach(c => {
      c.style.width = `${width}px`;
      c.style.minWidth = `${width}px`;
    });

    if (col === 0) {
      document.querySelectorAll('.kooperation-video-grid thead th:nth-child(2)').forEach(h => { h.style.left = `${width}px`; });
      document.querySelectorAll('.kooperation-video-grid tbody td:nth-child(2)').forEach(c => { c.style.left = `${width}px`; });
    }
  }

  endResize() {
    this.table.isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    this.saveColumnWidths();
  }

  saveColumnWidths() {
    try {
      const obj = {};
      this.table.columnWidths.forEach((w, col) => { obj[col] = w; });
      localStorage.setItem(this.table.storageKey, JSON.stringify(obj));
    } catch { /* ignore */ }
  }

  loadColumnWidths() {
    try {
      const saved = localStorage.getItem(this.table.storageKey);
      if (saved) {
        Object.entries(JSON.parse(saved)).forEach(([col, width]) => {
          this.setColumnWidth(parseInt(col), width);
        });
      }
    } catch { /* ignore */ }
  }

  // --- Drag to Scroll ---

  bindDragToScroll() {
    const container = document.querySelector('.grid-wrapper');
    if (!container) return;

    this._dragScrollAbort?.abort();
    this._dragScrollAbort = new AbortController();
    const signal = this._dragScrollAbort.signal;

    this.table.dragScrollContainer = container;

    container.addEventListener('mousedown', (e) => {
      if (
        e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' ||
        e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' ||
        e.target.classList.contains('resize-handle-col') ||
        e.target.closest('.resize-handle-col') ||
        e.target.tagName === 'A' || e.target.closest('a') ||
        this.table.isResizing
      ) return;

      this.table.isDragging = true;
      this.table.startX = e.pageX - container.offsetLeft;
      this.table.scrollLeft = container.scrollLeft;
      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
      e.preventDefault();
    }, { signal });

    container.addEventListener('mousemove', (e) => {
      if (!this.table.isDragging) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      container.scrollLeft = this.table.scrollLeft - (x - this.table.startX) * 1.5;
    }, { signal });

    const stopDragging = () => {
      if (this.table.isDragging) {
        this.table.isDragging = false;
        container.style.cursor = 'grab';
        container.style.userSelect = '';
      }
    };
    container.addEventListener('mouseup', stopDragging, { signal });
    container.addEventListener('mouseleave', stopDragging, { signal });

    container.style.cursor = 'grab';
  }

  // --- Floating Scrollbar ---

  initFloatingScrollbar() {
    this._scrollbarAbort?.abort();
    this._scrollbarAbort = new AbortController();
    const abortSignal = this._scrollbarAbort.signal;

    let floatingScrollbar = document.getElementById('floating-scrollbar-kampagne');
    if (!floatingScrollbar) {
      floatingScrollbar = document.createElement('div');
      floatingScrollbar.id = 'floating-scrollbar-kampagne';
      floatingScrollbar.className = 'floating-scrollbar-kampagne';
      const inner = document.createElement('div');
      inner.className = 'floating-scrollbar-inner';
      floatingScrollbar.appendChild(inner);
      document.body.appendChild(floatingScrollbar);
    }

    const gridWrapper = document.querySelector('.grid-wrapper');
    const tableEl = document.querySelector('.kooperation-video-grid');
    const mainWrapper = document.querySelector('.main-wrapper');
    if (!gridWrapper || !tableEl || !mainWrapper) return;

    const inner = floatingScrollbar.querySelector('.floating-scrollbar-inner');
    const updateWidth = () => { inner.style.width = tableEl.scrollWidth + 'px'; };
    const updatePosition = () => {
      const rect = gridWrapper.getBoundingClientRect();
      floatingScrollbar.style.left = rect.left + 'px';
      floatingScrollbar.style.width = rect.width + 'px';
    };

    updateWidth();
    updatePosition();

    const resizeObserver = new ResizeObserver(() => { updateWidth(); updatePosition(); });
    resizeObserver.observe(tableEl);
    resizeObserver.observe(mainWrapper);

    let syncFromFloating = false;
    let syncFromTable = false;

    const onFloatingScroll = () => {
      if (syncFromTable) return;
      syncFromFloating = true;
      gridWrapper.scrollLeft = floatingScrollbar.scrollLeft;
      requestAnimationFrame(() => { syncFromFloating = false; });
    };
    floatingScrollbar.addEventListener('scroll', onFloatingScroll);

    const onTableScroll = () => {
      if (syncFromFloating) return;
      syncFromTable = true;
      floatingScrollbar.scrollLeft = gridWrapper.scrollLeft;
      requestAnimationFrame(() => { syncFromTable = false; });
    };
    gridWrapper.addEventListener('scroll', onTableScroll);

    const toggleVisibility = () => {
      const tableRect = gridWrapper.getBoundingClientRect();
      const isOnPage = window.location.pathname.includes('/kampagne/');
      const needsScroll = tableEl.scrollWidth > gridWrapper.clientWidth;
      const isVisible = tableRect.top < window.innerHeight && tableRect.bottom > 0;

      if (isOnPage && needsScroll && isVisible) {
        updatePosition();
        floatingScrollbar.classList.add('visible');
      } else {
        floatingScrollbar.classList.remove('visible');
      }
    };

    toggleVisibility();

    const onScroll = () => toggleVisibility();
    const onResize = () => { updatePosition(); toggleVisibility(); };
    window.addEventListener('scroll', onScroll, { signal: abortSignal });
    window.addEventListener('resize', onResize, { signal: abortSignal });

    const cleanup = () => {
      floatingScrollbar.classList.remove('visible');
      resizeObserver.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      floatingScrollbar.removeEventListener('scroll', onFloatingScroll);
      gridWrapper.removeEventListener('scroll', onTableScroll);
    };

    document.addEventListener('tab-changed', cleanup, { signal: abortSignal });

    const navCleanup = () => {
      if (!window.location.pathname.includes('/kampagne/')) {
        cleanup();
        if (floatingScrollbar?.parentNode) floatingScrollbar.parentNode.removeChild(floatingScrollbar);
      }
    };
    window.addEventListener('popstate', navCleanup, { signal: abortSignal });

    this.table.cleanupFloatingScrollbar = cleanup;
  }

  destroy() {
    this._resizeAbort?.abort();
    this._resizeAbort = null;
    this._dragScrollAbort?.abort();
    this._dragScrollAbort = null;
    this._scrollbarAbort?.abort();
    this._scrollbarAbort = null;
    if (this.table.cleanupFloatingScrollbar) {
      this.table.cleanupFloatingScrollbar();
      this.table.cleanupFloatingScrollbar = null;
    }
  }
}
