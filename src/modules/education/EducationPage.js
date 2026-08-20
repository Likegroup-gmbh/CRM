// EducationPage.js - Education/Wissensdatenbank Seite
// Card-basierte Übersicht mit Kategorien, Tags und Suche

import { KUNDE_ALLOWED_SLUGS, ARTICLE_DISPLAY_OVERRIDES } from './EducationConstants.js';
import { resolveEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';

export const educationPage = {
  articles: [],
  categories: [],
  tags: [],
  selectedCategory: null,
  selectedTags: [],
  searchQuery: '',

  async init() {
    console.log('📚 EducationPage: init()');
    
    window.setHeadline('Education');
    
    // Daten laden
    await this.loadData();
    
    // Rendern
    this.render();
    
    // Events binden
    this.bindEvents();
  },

  async loadData() {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar');
        return;
      }

      // Kategorien laden
      const { data: categories, error: catError } = await window.supabase
        .from('education_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (catError) throw catError;
      this.categories = categories || [];

      // Tags laden
      const { data: tags, error: tagError } = await window.supabase
        .from('education_tags')
        .select('*')
        .order('name', { ascending: true });

      if (tagError) throw tagError;
      this.tags = tags || [];

      // Artikel mit Kategorie und Tags laden (nur published)
      const isKunde = window.isKunde();

      let articlesQuery = window.supabase
        .from('education_articles')
        .select(`
          *,
          category:category_id(id, name, icon),
          article_tags:education_article_tags(
            tag:tag_id(id, name)
          )
        `)
        .eq('status', 'published');

      if (isKunde) {
        articlesQuery = articlesQuery.in('slug', KUNDE_ALLOWED_SLUGS);
      }

      const { data: articles, error: artError } = await articlesQuery
        .order('created_at', { ascending: false });

      if (artError) throw artError;
      
      // Tags flach machen + Display-Overrides anwenden
      this.articles = (articles || []).map(article => {
        const override = ARTICLE_DISPLAY_OVERRIDES[article.slug];
        return {
          ...article,
          ...(override ? { title: override.title, short_description: override.short_description } : {}),
          tags: (article.article_tags || []).map(at => at.tag).filter(Boolean)
        };
      });

      console.log('✅ Education-Daten geladen:', {
        categories: this.categories.length,
        tags: this.tags.length,
        articles: this.articles.length
      });

    } catch (error) {
      console.error('❌ Fehler beim Laden der Education-Daten:', error);
      this.categories = [];
      this.tags = [];
      this.articles = [];
    }
  },

  getFilteredArticles() {
    const isKunde = window.isKunde();
    let filtered = isKunde
      ? this.articles.filter(a => KUNDE_ALLOWED_SLUGS.includes(a.slug))
      : [...this.articles];

    // Nach Kategorie filtern
    if (this.selectedCategory) {
      filtered = filtered.filter(a => a.category_id === this.selectedCategory);
    }

    // Nach Tags filtern
    if (this.selectedTags.length > 0) {
      filtered = filtered.filter(article => {
        const articleTagIds = article.tags.map(t => t.id);
        return this.selectedTags.every(tagId => articleTagIds.includes(tagId));
      });
    }

    // Nach Suchbegriff filtern
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(article => 
        article.title.toLowerCase().includes(query) ||
        (article.short_description || '').toLowerCase().includes(query) ||
        article.tags.some(tag => tag.name.toLowerCase().includes(query))
      );
    }

    return filtered;
  },

  render() {
    const filteredArticles = this.getFilteredArticles();

    const html = `
      <div class="education-page">
        <!-- Header mit Suche -->
        <div class="education-header">
          <div class="education-search">
            ${icon('search')}
            <input 
              type="text" 
              id="education-search" 
              class="education-search-input" 
              placeholder="Artikel durchsuchen..."
              value="${this.searchQuery}"
            >
          </div>
        </div>

        <!-- Filter-Bereich -->
        <div class="education-filters">
          <!-- Kategorien -->
          <div class="education-filter-section">
            <div class="education-filter-label">Kategorien</div>
            <div class="education-category-filters">
              <button class="education-category-btn ${!this.selectedCategory ? 'active' : ''}" data-category="">
                Alle
              </button>
              ${this.categories.map(cat => `
                <button class="education-category-btn ${this.selectedCategory === cat.id ? 'active' : ''}" data-category="${cat.id}">
                  ${this.getCategoryIcon(cat.icon)}
                  ${cat.name}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Tags -->
          ${this.tags.length > 0 ? `
            <div class="education-filter-section">
              <div class="education-filter-label">Tags</div>
              <div class="education-tag-filters">
                ${this.tags.map(tag => `
                  <button class="education-tag-btn ${this.selectedTags.includes(tag.id) ? 'active' : ''}" data-tag="${tag.id}">
                    ${tag.name}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Artikel-Grid -->
        <div class="education-content">
          ${filteredArticles.length > 0 ? `
            <div class="education-grid">
              ${filteredArticles.map(article => this.renderArticleCard(article)).join('')}
            </div>
          ` : resolveEmptyState({
            hasActiveFilters: !!(this.searchQuery || this.selectedCategory || this.selectedTags.length > 0),
            states: {
              filtered: { icon: 'search', title: 'Keine Artikel gefunden', text: 'Versuche andere Filter oder Suchbegriffe.', actions: [] },
              default: { icon: 'document', title: 'Keine Artikel gefunden', text: 'Es wurden noch keine Artikel veröffentlicht.' }
            }
          }, 'default')}
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  },

  renderArticleCard(article) {
    const categoryName = article.category?.name || 'Allgemein';
    const categoryIcon = article.category?.icon || 'icon-document';
    const tags = article.tags || [];
    const date = new Date(article.created_at).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    return `
      <article class="education-card" data-slug="${article.slug}">
        <div class="education-card-header">
          <span class="education-card-category">
            ${this.getCategoryIcon(categoryIcon)}
            ${categoryName}
          </span>
          <span class="education-card-date">${date}</span>
        </div>
        <h3 class="education-card-title">${article.title}</h3>
        <p class="education-card-description">${article.short_description || ''}</p>
        ${tags.length > 0 ? `
          <div class="education-card-tags">
            ${tags.slice(0, 4).map(tag => `
              <span class="education-card-tag">${tag.name}</span>
            `).join('')}
            ${tags.length > 4 ? `<span class="education-card-tag education-card-tag--more">+${tags.length - 4}</span>` : ''}
          </div>
        ` : ''}
        <div class="education-card-footer">
          <span class="education-card-link">
            Artikel lesen
            ${icon('arrow-right')}
          </span>
        </div>
      </article>
    `;
  },

  getCategoryIcon(iconName) {
    const icons = {
      'icon-briefcase': `${icon('video')}`,
      'icon-building': `${icon('table-grid')}`,
      'icon-campaign': `${icon('speaker-wave')}`,
      'icon-settings': `${icon('cog')}`,
      'icon-document': `${icon('document-duplicate')}`
    };
    return icons[iconName] || icons['icon-document'];
  },

  bindEvents() {
    // Suche
    const searchInput = document.getElementById('education-search');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchQuery = e.target.value;
          this.render();
          this.bindEvents();
        }, 300);
      });
    }

    // Kategorie-Filter
    document.querySelectorAll('.education-category-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const categoryId = e.currentTarget.dataset.category;
        this.selectedCategory = categoryId || null;
        this.render();
        this.bindEvents();
      });
    });

    // Tag-Filter
    document.querySelectorAll('.education-tag-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tagId = e.currentTarget.dataset.tag;
        if (this.selectedTags.includes(tagId)) {
          this.selectedTags = this.selectedTags.filter(id => id !== tagId);
        } else {
          this.selectedTags.push(tagId);
        }
        this.render();
        this.bindEvents();
      });
    });

    // Artikel-Card Klick
    document.querySelectorAll('.education-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const slug = card.dataset.slug;
        if (slug) {
          window.navigateTo(`/education/${slug}`);
        }
      });
    });
  },

  destroy() {
    console.log('🗑️ EducationPage: destroy()');
    this.selectedCategory = null;
    this.selectedTags = [];
    this.searchQuery = '';
  }
};
