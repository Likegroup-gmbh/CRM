// EducationArticleDetail.js - Einzelner Education-Artikel
// Markdown-Rendering und verwandte Artikel

export const educationArticleDetail = {
  article: null,
  relatedArticles: [],

  async init(slug) {
    console.log('📖 EducationArticleDetail: init() für slug:', slug);
    
    if (!slug) {
      window.navigateTo('/education');
      return;
    }
    
    // Artikel laden
    await this.loadArticle(slug);
    
    if (!this.article) {
      window.setHeadline('Artikel nicht gefunden');
      window.content.innerHTML = this.renderNotFound();
      this.bindBackButton();
      return;
    }
    
    // Headline & Breadcrumb
    window.setHeadline(this.article.title);
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Education', url: '/education', clickable: true },
        { label: this.article.title, url: `/education/${slug}`, clickable: false }
      ]);
    }
    
    // View-Count erhöhen
    this.incrementViewCount();
    
    // Verwandte Artikel laden
    await this.loadRelatedArticles();
    
    // Rendern
    this.render();
    
    // Events binden
    this.bindEvents();
  },

  async loadArticle(slug) {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar');
        return;
      }

      const { data: article, error } = await window.supabase
        .from('education_articles')
        .select(`
          *,
          category:category_id(id, name, icon),
          author:author_id(id, name),
          article_tags:education_article_tags(
            tag:tag_id(id, name)
          )
        `)
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (error) {
        console.error('❌ Fehler beim Laden des Artikels:', error);
        this.article = null;
        return;
      }

      // Tags flach machen
      this.article = {
        ...article,
        tags: (article.article_tags || []).map(at => at.tag).filter(Boolean)
      };

      console.log('✅ Artikel geladen:', this.article.title);

    } catch (error) {
      console.error('❌ Fehler beim Laden des Artikels:', error);
      this.article = null;
    }
  },

  async incrementViewCount() {
    if (!this.article?.id || !window.supabase) return;
    
    try {
      await window.supabase.rpc('increment_education_view_count', {
        article_id: this.article.id
      });
    } catch (e) {
      // Ignorieren wenn RPC nicht existiert
      console.log('View-Count-RPC nicht verfügbar');
    }
  },

  async loadRelatedArticles() {
    if (!this.article?.category_id || !window.supabase) {
      this.relatedArticles = [];
      return;
    }

    try {
      const { data: related, error } = await window.supabase
        .from('education_articles')
        .select('id, title, slug, short_description')
        .eq('category_id', this.article.category_id)
        .eq('status', 'published')
        .neq('id', this.article.id)
        .limit(3);

      if (error) throw error;
      this.relatedArticles = related || [];

    } catch (error) {
      console.error('❌ Fehler beim Laden verwandter Artikel:', error);
      this.relatedArticles = [];
    }
  },

  render() {
    const article = this.article;
    const date = new Date(article.created_at).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    const categoryName = article.category?.name || 'Allgemein';
    const authorName = article.author?.name || 'System';
    const tags = article.tags || [];

    const html = `
      <div class="education-article-page">
        <!-- Artikel Header -->
        <div class="education-article-header">
          <div class="education-article-meta">
            <span class="education-article-category">
              ${categoryName}
            </span>
            <span class="education-article-date">${date}</span>
            ${article.view_count > 0 ? `<span class="education-article-views">${article.view_count} Aufrufe</span>` : ''}
          </div>
          <h1 class="education-article-title">${article.title}</h1>
          ${article.short_description ? `
            <p class="education-article-description">${article.short_description}</p>
          ` : ''}
          ${tags.length > 0 ? `
            <div class="education-article-tags">
              ${tags.map(tag => `
                <span class="education-article-tag">${tag.name}</span>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Artikel Content -->
        <div class="education-article-content">
          ${this.renderMarkdown(article.content || '')}
        </div>

        <!-- Artikel Footer -->
        <div class="education-article-footer">
          <div class="education-article-author">
            <span>Autor:</span> ${authorName}
          </div>
          <button class="secondary-btn" id="btn-back-to-education">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            ${window.currentUser?.rolle === 'kunde' ? 'Zurück zum Dashboard' : 'Zurück zur Übersicht'}
          </button>
        </div>

        <!-- Verwandte Artikel -->
        ${this.relatedArticles.length > 0 ? `
          <div class="education-related">
            <h3 class="education-related-title">Verwandte Artikel</h3>
            <div class="education-related-grid">
              ${this.relatedArticles.map(related => `
                <a href="/education/${related.slug}" class="education-related-card" data-slug="${related.slug}">
                  <h4>${related.title}</h4>
                  <p>${related.short_description || ''}</p>
                </a>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    window.setContentSafely(window.content, html);
  },

  renderNotFound() {
    const backLabel = window.currentUser?.rolle === 'kunde' ? 'Zurück zum Dashboard' : 'Zurück zur Übersicht';
    return `
      <div class="education-not-found">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="not-found-icon">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        <h2>Artikel nicht gefunden</h2>
        <p>Der gesuchte Artikel existiert nicht oder wurde entfernt.</p>
        <button class="primary-btn" id="btn-back-to-education">
          ${backLabel}
        </button>
      </div>
    `;
  },

  // Einfaches Markdown-Rendering (ohne externe Library)
  renderMarkdown(content) {
    if (!content) return '';

    let html = content;

    // Escape HTML (außer erlaubte Tags)
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code-Blöcke (```...```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre class="code-block${lang ? ` language-${lang}` : ''}"><code>${code.trim()}</code></pre>`;
    });

    // Inline Code (`...`)
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold & Italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Tabellen
    html = this.renderTables(html);

    // Listen (unordered)
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Listen (ordered)
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Horizontale Linie
    html = html.replace(/^---$/gm, '<hr>');

    // Paragraphen (doppelte Newlines)
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Leere Paragraphen entfernen
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');
    html = html.replace(/<p>(<table)/g, '$1');
    html = html.replace(/(<\/table>)<\/p>/g, '$1');
    html = html.replace(/<p>(<hr>)<\/p>/g, '$1');

    return html;
  },

  renderTables(html) {
    // Einfaches Tabellen-Parsing
    const tableRegex = /\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)+)/g;
    
    return html.replace(tableRegex, (match, headerRow, bodyRows) => {
      const headers = headerRow.split('|').filter(h => h.trim());
      const rows = bodyRows.trim().split('\n').map(row => 
        row.split('|').filter(c => c.trim())
      );

      const headerHtml = headers.map(h => `<th>${h.trim()}</th>`).join('');
      const bodyHtml = rows.map(row => 
        `<tr>${row.map(cell => `<td>${cell.trim()}</td>`).join('')}</tr>`
      ).join('');

      return `<table class="education-table">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>`;
    });
  },

  getBackUrl() {
    return window.currentUser?.rolle === 'kunde' ? '/dashboard' : '/education';
  },

  bindBackButton() {
    const backBtn = document.getElementById('btn-back-to-education');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.navigateTo(this.getBackUrl());
      });
    }
  },

  bindEvents() {
    // Zurück-Button
    this.bindBackButton();

    // Verwandte Artikel Links
    document.querySelectorAll('.education-related-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const slug = card.dataset.slug;
        if (slug) {
          window.navigateTo(`/education/${slug}`);
        }
      });
    });
  },

  destroy() {
    console.log('🗑️ EducationArticleDetail: destroy()');
    this.article = null;
    this.relatedArticles = [];
  }
};
