// EducationPage.js - Education/Wissensdatenbank Seite
// Card-basierte Übersicht mit Kategorien, Tags und Suche

export const educationPage = {
  articles: [],
  categories: [],
  tags: [],
  selectedCategory: null,
  selectedTags: [],
  searchQuery: '',

  async init() {
    console.log('📚 EducationPage: init()');
    
    // Headline & Breadcrumb
    window.setHeadline('Education');
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Education', url: '/education', clickable: false }
      ]);
    }
    
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
      const { data: articles, error: artError } = await window.supabase
        .from('education_articles')
        .select(`
          *,
          category:category_id(id, name, icon),
          article_tags:education_article_tags(
            tag:tag_id(id, name)
          )
        `)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (artError) throw artError;
      
      // Tags flach machen
      this.articles = (articles || []).map(article => ({
        ...article,
        tags: (article.article_tags || []).map(at => at.tag).filter(Boolean)
      }));

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
    let filtered = [...this.articles];

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
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="search-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
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
          ` : `
            <div class="education-empty">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="empty-icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
              <h3>Keine Artikel gefunden</h3>
              <p>${this.searchQuery || this.selectedCategory || this.selectedTags.length > 0 
                ? 'Versuche andere Filter oder Suchbegriffe.' 
                : 'Es wurden noch keine Artikel veröffentlicht.'}</p>
            </div>
          `}
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
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </div>
      </article>
    `;
  },

  getCategoryIcon(iconName) {
    const icons = {
      'icon-briefcase': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" /></svg>`,
      'icon-building': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" /></svg>`,
      'icon-campaign': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" /></svg>`,
      'icon-settings': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`,
      'icon-document': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>`
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
