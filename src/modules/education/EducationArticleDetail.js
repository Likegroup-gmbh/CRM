// EducationArticleDetail.js - Einzelner Education-Artikel
// Markdown-Rendering und verwandte Artikel

import { KUNDE_ALLOWED_SLUGS, ARTICLE_DISPLAY_OVERRIDES } from './EducationConstants.js';
import { icon } from '../../core/icons/IconSystem.js';
import { renderMarkdown } from '../../core/markdownRenderer.js';

export const educationArticleDetail = {
  article: null,
  relatedArticles: [],

  isKundeRole() {
    return window.isKunde();
  },

  async init(slug) {
    console.log('📖 EducationArticleDetail: init() für slug:', slug);
    
    if (!slug) {
      window.navigateTo('/education');
      return;
    }

    // Kunden dürfen nur freigegebene Artikel sehen
    if (this.isKundeRole() && !KUNDE_ALLOWED_SLUGS.includes(slug)) {
      window.navigateTo('/dashboard');
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

    // Display-Override anwenden (konsistenter Titel über alle Seiten)
    const override = ARTICLE_DISPLAY_OVERRIDES[slug];
    if (override) {
      this.article.title = override.title;
      if (override.short_description) this.article.short_description = override.short_description;
    }
    
    // Headline & Breadcrumb
    window.setHeadline(this.article.title);
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel(this.article.title);
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
        <div class="md-content">
          ${renderMarkdown(article.content || '')}
        </div>

        <!-- Artikel Footer -->
        <div class="education-article-footer">
          <div class="education-article-author">
            <span>Autor:</span> ${authorName}
          </div>
          <button class="mdc-btn mdc-btn--secondary" id="btn-back-to-education">
            ${icon('arrow-left')}
            ${this.isKundeRole() ? 'Zurück zum Dashboard' : 'Zurück zur Übersicht'}
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
    const backLabel = this.isKundeRole() ? 'Zurück zum Dashboard' : 'Zurück zur Übersicht';
    return `
      <div class="education-not-found">
        ${icon('exclamation-circle')}
        <h2>Artikel nicht gefunden</h2>
        <p>Der gesuchte Artikel existiert nicht oder wurde entfernt.</p>
        <button class="mdc-btn" id="btn-back-to-education">
          ${backLabel}
        </button>
      </div>
    `;
  },

  getBackUrl() {
    return this.isKundeRole() ? '/dashboard' : '/education';
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
