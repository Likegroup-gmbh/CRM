// CreatorDetailRenderers.js
// Tab-Content Renderer fuer CreatorDetail (Prototype-Mixin)

import { CreatorDetail } from './CreatorDetailCore.js';
import { renderKampagnenTable } from '../kampagne/KampagneTable.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { VertragUtils } from '../vertrag/VertragUtils.js';
import { renderEmptyState, renderSectionHeader } from '../../core/components/EmptyState.js';
import { icon, renderPdfLinks } from '../../core/icons/IconSystem.js';
import { HAUPTADRESSE_QUELLE, normalizeHauptadresseQuelle } from './hauptadresseQuelle.js';

const PLUS_ICON_SVG = `${icon('plus-lg')}`;

// Instagram-Sektion: Daten aus dem Connect (nur wenn erfolgreich verbunden)
CreatorDetail.prototype.renderInstagramSection = function() {
    const c = this.creator || {};
    if (!c.ig_connected_at) {
      const hasLink = !!c.instagram;
      return renderEmptyState({
        icon: 'instagram',
        title: 'Noch nicht mit Instagram verbunden',
        text: hasLink
          ? 'Ueber die Connect-Aktion im Aktionsmenue der Creator-Liste koennen die Instagram-Daten (Follower, Engagement, letzte Posts) geladen werden.'
          : 'Fuer diesen Creator ist kein Instagram-Link hinterlegt. Ohne Link kann kein Connect ausgefuehrt werden.'
      });
    }

    const safe = (val) => window.validatorSystem?.sanitizeHtml?.(String(val ?? '')) ?? String(val ?? '');
    const safeUrl = (url) => window.validatorSystem?.sanitizeUrl?.(url) || '';
    const num = (val) => (val != null && !isNaN(val)) ? Number(val).toLocaleString('de-DE') : '-';

    const username = c.ig_username || '';
    const profileUrl = username ? `https://instagram.com/${encodeURIComponent(username)}` : '';

    const engagement = (c.ig_engagement_rate != null && !isNaN(c.ig_engagement_rate))
      ? `${Number(c.ig_engagement_rate).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`
      : '-';

    const brands = Array.isArray(c.ig_brand_mentions) ? c.ig_brand_mentions : [];
    const brandsHtml = brands.length
      ? `<div class="tags">${brands.map(b => `<a class="tag tag--brand" href="https://instagram.com/${encodeURIComponent(b)}" target="_blank" rel="noopener noreferrer">@${safe(b)}</a>`).join('')}</div>`
      : '<span class="ig-muted">Keine Werbe-Kooperationen in den letzten Posts erkannt</span>';

    const posts = Array.isArray(c.ig_recent_posts) ? c.ig_recent_posts : [];
    const postsHtml = posts.length
      ? `<div class="ig-posts-grid">${posts.map(p => {
          const link = safeUrl(p.permalink) || profileUrl;
          const thumb = safeUrl(p.thumbnail_path);
          const isVideo = p.media_type === 'VIDEO';
          const captionTeaser = p.caption ? safe(String(p.caption).slice(0, 120)) : '';
          const date = p.timestamp ? new Date(p.timestamp).toLocaleDateString('de-DE') : '';
          return `
            <a class="ig-post-card" href="${link}" target="_blank" rel="noopener noreferrer" title="${captionTeaser}">
              <div class="ig-post-thumb">
                ${thumb
                  ? `<img src="${thumb}" alt="Instagram Post" loading="lazy" />`
                  : '<div class="ig-post-thumb-placeholder">Kein Bild</div>'}
                ${isVideo ? '<span class="ig-post-type-badge">Reel</span>' : ''}
              </div>
              <div class="ig-post-meta">
                <span>&hearts; ${num(p.like_count)}</span>
                <span>&#128172; ${num(p.comments_count)}</span>
                ${date ? `<span class="ig-post-date">${date}</span>` : ''}
              </div>
            </a>
          `;
        }).join('')}</div>`
      : '<span class="ig-muted">Keine Posts gespeichert</span>';

    return `
      <div class="detail-card ig-section">
        <div class="ig-section-header">
          <h3 class="section-title">Instagram</h3>
          <span class="ig-connected-info">
            <span class="ig-connected-badge"></span>
            Verbunden – Stand: ${this.formatDate(c.ig_connected_at)}
            ${profileUrl ? `&nbsp;·&nbsp;<a href="${profileUrl}" target="_blank" rel="noopener noreferrer">@${safe(username)}</a>` : ''}
          </span>
        </div>

        <div class="ig-stats-row">
          <div class="ig-stat">
            <span class="ig-stat-value">${num(c.instagram_follower)}</span>
            <span class="ig-stat-label">Follower</span>
          </div>
          <div class="ig-stat">
            <span class="ig-stat-value">${icon('engagement', { className: 'ig-stat-icon' })}${engagement}</span>
            <span class="ig-stat-label">Engagement-Rate</span>
          </div>
          <div class="ig-stat">
            <span class="ig-stat-value">${num(c.ig_media_count)}</span>
            <span class="ig-stat-label">Posts</span>
          </div>
        </div>

        ${c.ig_biography ? `
        <div class="detail-item ig-bio">
          <label>Beschreibung:</label>
          <span>${safe(c.ig_biography)}</span>
        </div>
        ` : ''}

        <div class="detail-item">
          <label>Kooperationen:</label>
          <span>${brandsHtml}</span>
        </div>

        <div class="ig-posts-block">
          <label>Letzte Posts:</label>
          ${postsHtml}
        </div>
      </div>
    `;
};

CreatorDetail.prototype.renderFirmenContent = function() {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str || '-') ?? (str || '-');
    const items = this.firmen || [];

    const anlegenBtn = `
      <button class="mdc-btn mdc-btn--sm" id="btn-firma-anlegen">
        ${PLUS_ICON_SVG}
        Firma anlegen
      </button>
    `;

    if (!items.length) {
      return renderEmptyState({
        icon: 'building',
        title: 'Keine Firma zugeordnet',
        text: 'Diesem Creator ist noch keine Firma zugeordnet.',
        actionsHtml: anlegenBtn
      });
    }

    const rows = items.map(f => `
      <tr>
        <td>${safe(f.firmenname || '—')}</td>
        <td>${safe(f.strasse || '-')}</td>
        <td>${safe(f.hausnummer || '-')}</td>
        <td>${safe(f.plz || '-')}</td>
        <td>${safe(f.stadt || '-')}</td>
        <td>${safe(f.land || '-')}</td>
        <td>
          <button class="icon-btn" title="Zuordnung entfernen" data-remove-firma="${f.id}">
            ${icon('x-mark', { className: 'icon-16' })}
          </button>
        </td>
      </tr>
    `).join('');

    return `
      ${renderSectionHeader({ title: 'Firmen', actionsHtml: anlegenBtn })}
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Firmenname</th>
              <th>Straße</th>
              <th>Hausnummer</th>
              <th>PLZ</th>
              <th>Stadt</th>
              <th>Land</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
};

CreatorDetail.prototype.renderTagList = function(items) {
    if (!items || items.length === 0) return '-';
    if (Array.isArray(items)) {
      const inner = items.map(it => {
        const label = typeof it === 'object' ? (it.name || it.label || it) : it;
        return `<span class="tag">${String(label).trim()}</span>`;
      }).join('');
      return `<div class="tags">${inner}</div>`;
    }
    if (typeof items === 'object') {
      const label = items.name || items.label;
      return label ? `<div class="tags"><span class="tag">${label}</span></div>` : '-';
    }
    return `<div class="tags"><span class="tag">${String(items)}</span></div>`;
};

CreatorDetail.prototype.renderKampagnenContent = function() {
    if (!this.kampagnen || this.kampagnen.length === 0) {
      return renderEmptyState({
        icon: 'megaphone',
        title: 'Keine Kampagnen',
        text: 'Dieser Creator ist noch keiner Kampagne zugeordnet.'
      });
    }

    const flat = this.kampagnen.map(k => {
      const base = k.kampagne || k;
      return {
        id: base.id,
        kampagnenname: base.kampagnenname,
        eigener_name: base.eigener_name,
        unternehmen: base.unternehmen || null,
        marke: base.marke || null,
        art_der_kampagne: base.art_der_kampagne,
        status: base.status,
        start: base.start,
        deadline: base.deadline,
        creatoranzahl: base.creatoranzahl,
        videoanzahl: base.videoanzahl,
      };
    });

    return `
      ${renderSectionHeader({ title: 'Kampagnen' })}
      ${renderKampagnenTable(flat, { showActions: false })}
    `;
};

CreatorDetail.prototype.renderListenContent = function() {
    if (this.lists.length === 0) {
      return renderEmptyState({
        icon: 'list',
        title: 'Keine Listen',
        text: 'Dieser Creator ist noch keiner Liste zugeordnet.'
      });
    }

    const listsHtml = this.lists.map(list => `
      <div class="list-card">
        <div class="list-header">
          <h4>${list.list.name}</h4>
          <span class="list-date">Hinzugefügt: ${this.formatDate(list.added_at)}</span>
        </div>
        <div class="list-details">
          <small>Liste erstellt: ${this.formatDate(list.list.created_at)}</small>
        </div>
      </div>
    `).join('');

    return `
      ${renderSectionHeader({ title: 'Listen' })}
      <div class="lists-container">${listsHtml}</div>
    `;
};

CreatorDetail.prototype.renderKooperationenContent = function() {
    if (this.kooperationen.length === 0) {
      return renderEmptyState({
        icon: 'handshake',
        title: 'Keine Kooperationen vorhanden',
        text: 'Für diesen Creator wurden noch keine Kooperationen erstellt.'
      });
    }

    const rows = this.kooperationen.map(k => `
      <tr>
        <td>
          <a href="/kooperation/${k.id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/kooperation/${k.id}')">
            ${window.validatorSystem.sanitizeHtml(k.name || 'Kooperation')}
          </a>
        </td>
        <td>
          <a href="/kampagne/${k.kampagne?.id || ''}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/kampagne/${k.kampagne?.id || ''}')">
            ${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(k.kampagne))}
          </a>
        </td>
        <td><span class="status-badge status-${(k.status || 'unknown').toLowerCase().replace(/\s+/g, '-')}">${k.status || '-'}</span></td>
        <td>${k.videoanzahl || 0}</td>
        <td>${k.einkaufspreis_gesamt ? this.formatCurrency(k.einkaufspreis_gesamt) : '-'}</td>
        <td>${this.formatDate(k.created_at)}</td>
      </tr>
    `).join('');

    return `
      ${renderSectionHeader({ title: 'Kooperationen' })}
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Kampagne</th>
              <th>Status</th>
              <th>Videos</th>
              <th>Gesamtkosten</th>
              <th>Erstellt</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
};

CreatorDetail.prototype.renderRechnungenContent = function() {
    if (!this.rechnungen || this.rechnungen.length === 0) {
      return renderEmptyState({
        icon: 'invoice',
        title: 'Keine Rechnungen vorhanden',
        text: 'Für diesen Creator wurden noch keine Rechnungen erfasst.'
      });
    }

    const rows = this.rechnungen.map(r => `
      <tr>
        <td><a href="/rechnung/${r.id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${window.validatorSystem.sanitizeHtml(r.rechnung_nr || '—')}</a></td>
        <td>${r.status || '-'}</td>
        <td>${this.formatCurrency(r.nettobetrag)}</td>
        <td>${this.formatCurrency(r.bruttobetrag)}</td>
        <td>${this.formatDate(r.gestellt_am)}</td>
        <td>${this.formatDate(r.bezahlt_am)}</td>
        <td>${renderPdfLinks(r.rechnung_pdfs, r.pdf_url)}</td>
      </tr>
    `).join('');

    return `
      ${renderSectionHeader({ title: 'Rechnungen' })}
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr</th>
              <th>Status</th>
              <th>Netto</th>
              <th>Brutto</th>
              <th>Gestellt</th>
              <th>Bezahlt</th>
              <th>Beleg</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
};

CreatorDetail.prototype.renderVertraegeContent = function() {
    if (!this.vertraege || this.vertraege.length === 0) {
      return renderEmptyState({
        icon: 'document',
        title: 'Keine Verträge vorhanden',
        text: 'Für diesen Creator wurden noch keine Verträge erfasst.'
      });
    }

    const getStatusLabel = (isDraft) => isDraft ? 'Entwurf' : 'Final';
    const getStatusClass = (isDraft) => isDraft ? 'draft' : 'aktiv';

    const sanitize = (s) => window.validatorSystem.sanitizeHtml(s);
    const rows = this.vertraege.map(v => {
      const unternehmenName = v.kunde?.firmenname || '-';

      return `
        <tr>
          <td>${VertragUtils.renderVertragNameHtml(v, sanitize)}</td>
          <td>${sanitize(v.typ || '-')}</td>
          <td><span class="status-badge status-${getStatusClass(v.is_draft)}">${getStatusLabel(v.is_draft)}</span></td>
          <td>${VertragUtils.renderVertragContextHtml(v, sanitize)}</td>
          <td>${v.kunde ? `<a href="/unternehmen/${v.kunde.id}" class="table-link" data-table="unternehmen" data-id="${v.kunde.id}">${sanitize(unternehmenName)}</a>` : '-'}</td>
          <td>${renderPdfLinks(null, v.datei_url)}</td>
          <td>${this.formatDate(v.created_at)}</td>
        </tr>
      `;
    }).join('');

    return `
      ${renderSectionHeader({ title: 'Verträge' })}
      <div class="data-table-container">
        <table class="data-table vertraege-detail-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Typ</th>
              <th>Status</th>
              <th>Kontext</th>
              <th>Unternehmen</th>
              <th>Datei</th>
              <th>Erstellt am</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
};

CreatorDetail.prototype.renderUnternehmenContent = function() {
    const items = this.unternehmen || [];
    if (!items.length) {
      return renderEmptyState({
        icon: 'building',
        title: 'Keine Unternehmen vorhanden',
        text: 'Dieser Creator ist noch mit keinem Unternehmen verknüpft.'
      });
    }
    const rows = items.map(u => `
      <tr>
        <td><a href="/unternehmen/${u.id}" class="table-link" data-table="unternehmen" data-id="${u.id}">${window.validatorSystem.sanitizeHtml(u.firmenname || '—')}</a></td>
      </tr>`).join('');
    return `
      ${renderSectionHeader({ title: 'Unternehmen' })}
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Unternehmen</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
};

CreatorDetail.prototype.renderAdresseContent = function() {
    const c = this.creator || {};
    const sanitizeVal = (val) => {
      if (val === undefined || val === null || val === '') return '-';
      if (val === '-') return '-';
      return window.validatorSystem.sanitizeHtml(String(val));
    };

    const hauptAdresseTable = `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Firma</th>
              <th>Straße</th>
              <th>Hausnummer</th>
              <th>PLZ</th>
              <th>Stadt</th>
              <th>Land</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="badge badge-secondary">Creator-Adresse</span></td>
              <td>-</td>
              <td>${sanitizeVal(c.lieferadresse_strasse)}</td>
              <td>${sanitizeVal(c.lieferadresse_hausnummer)}</td>
              <td>${sanitizeVal(c.lieferadresse_plz)}</td>
              <td>${sanitizeVal(c.lieferadresse_stadt)}</td>
              <td>${sanitizeVal(c.lieferadresse_land)}</td>
              <td>
                ${actionBuilder.create('creator_hauptadresse', this.creatorId)}
              </td>
            </tr>
            ${this.renderZusatzAdressenRows()}
          </tbody>
        </table>
      </div>
    `;

    const neueAdresseBtn = `
      <button 
        class="mdc-btn mdc-btn--sm" 
        onclick="window.creatorAdressenManager?.open('${this.creatorId}')"
      >
        ${PLUS_ICON_SVG}
        Neue Adresse hinzufügen
      </button>
    `;

    return `
      <div class="creator-addresses-container">
        <div class="address-section">
          ${renderSectionHeader({ title: 'Hauptadresse (Vertrag)' })}
          <p class="field-hint">Diese Adresse wird im Vertragsgenerator verwendet. Versandadressen bleiben davon unabhängig.</p>
          ${this.renderHauptadressePicker()}
        </div>
        <div class="address-section">
          ${renderSectionHeader({ title: 'Adressen', actionsHtml: neueAdresseBtn })}
          ${this.creatorAdressen && this.creatorAdressen.length === 0 
            ? `${hauptAdresseTable}<p class="empty-text">Keine zusätzlichen Adressen hinterlegt.</p>` 
            : hauptAdresseTable
          }
        </div>
      </div>
    `;
};

CreatorDetail.prototype.renderHauptadressePicker = function() {
    const c = this.creator || {};
    const selected = normalizeHauptadresseQuelle(c.hauptadresse_quelle);
    const management = (this.managements || [])[0] || null;
    const firma = (this.firmen || [])[0] || null;

    const formatLine = (strasse, hausnummer, plz, stadt, land) => {
      const street = [strasse, hausnummer].filter(Boolean).join(' ').trim();
      const city = [plz, stadt].filter(Boolean).join(' ').trim();
      const parts = [street, city, land].filter(Boolean);
      return parts.length ? parts.join(', ') : 'Keine Adresse hinterlegt';
    };

    const rows = [
      {
        value: HAUPTADRESSE_QUELLE.CREATOR,
        title: 'Creator-Adresse',
        detail: formatLine(c.lieferadresse_strasse, c.lieferadresse_hausnummer, c.lieferadresse_plz, c.lieferadresse_stadt, c.lieferadresse_land),
        enabled: true
      },
      {
        value: HAUPTADRESSE_QUELLE.MANAGEMENT,
        title: management ? `Management: ${management.firmenname || '—'}` : 'Management-Adresse',
        detail: management
          ? formatLine(management.strasse, management.hausnummer, management.plz, management.stadt, management.land)
          : 'Kein Management zugeordnet',
        enabled: !!management
      },
      {
        value: HAUPTADRESSE_QUELLE.FIRMA,
        title: firma ? `Firma: ${firma.firmenname || '—'}` : 'Firmenadresse',
        detail: firma
          ? formatLine(firma.strasse, firma.hausnummer, firma.plz, firma.stadt, firma.land)
          : 'Keine Firma zugeordnet',
        enabled: !!firma
      }
    ];

    return `
      <div class="hauptadresse-picker" role="radiogroup" aria-label="Hauptadresse">
        ${rows.map(row => `
          <label class="radio-option hauptadresse-picker__option ${row.enabled ? '' : 'is-disabled'}">
            <input type="radio" name="hauptadresse_quelle" value="${row.value}"
                   ${selected === row.value ? 'checked' : ''}
                   ${row.enabled ? '' : 'disabled'}>
            <span>
              <strong>${window.validatorSystem.sanitizeHtml(row.title)}</strong>
              <small>${window.validatorSystem.sanitizeHtml(row.detail)}</small>
            </span>
          </label>
        `).join('')}
      </div>
    `;
};

CreatorDetail.prototype.renderZusatzAdressenRows = function() {
    if (!this.creatorAdressen || this.creatorAdressen.length === 0) {
      return '';
    }

    return this.creatorAdressen.map(adresse => `
      <tr>
        <td>
          <div class="address-name-cell">
            <span>${window.validatorSystem.sanitizeHtml(adresse.adressname)}</span>
            ${adresse.ist_standard ? `
              ${icon('star', { className: 'icon-18' })}
            ` : ''}
          </div>
        </td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.firmenname || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.strasse || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.hausnummer || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.plz || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.stadt || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.land || 'Deutschland')}</td>
        <td>
          ${actionBuilder.create('creator_adresse', adresse.id)}
        </td>
      </tr>
    `).join('');
};

CreatorDetail.prototype.formatNumber = function(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
};

CreatorDetail.prototype.formatAgeRange = function(min, max, legacy) {
    if (!min && !max && legacy) {
      return `${legacy} Jahre`;
    }
    if (!min && !max) return '-';
    if (min && max && min !== max) {
      return `${min}-${max} Jahre`;
    }
    return `${min || max} Jahre`;
};

CreatorDetail.prototype.renderManagementContent = function() {
    const items = this.managements || [];

    const actionButtons = `
      <button class="mdc-btn mdc-btn--sm" id="btn-management-zuordnen">
        ${PLUS_ICON_SVG}
        Management zuordnen
      </button>
      <button class="mdc-btn mdc-btn--secondary mdc-btn--sm" id="btn-management-anlegen" onclick="event.preventDefault(); window.navigateTo('/management/new')">
        Neues Management anlegen
      </button>
    `;

    if (!items.length) {
      return renderEmptyState({
        icon: 'management',
        title: 'Kein Management zugeordnet',
        text: 'Diesem Creator ist noch kein Management zugeordnet.',
        actionsHtml: actionButtons
      });
    }

    const rows = items.map(m => {
      const adresse = [m.strasse, m.hausnummer].filter(Boolean).join(' ');
      const ort = [m.plz, m.stadt].filter(Boolean).join(' ');
      return `
        <tr>
          <td>
            <a href="/management/${m.id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/management/${m.id}')">
              ${window.validatorSystem.sanitizeHtml(m.firmenname || '—')}
            </a>
          </td>
          <td>${window.validatorSystem.sanitizeHtml(adresse || '-')}</td>
          <td>${window.validatorSystem.sanitizeHtml(ort || '-')}</td>
          <td>${window.validatorSystem.sanitizeHtml(m.land || '-')}</td>
          <td>${m.email ? `<a href="mailto:${window.validatorSystem.sanitizeHtml(m.email)}">${window.validatorSystem.sanitizeHtml(m.email)}</a>` : '-'}</td>
          <td>${window.validatorSystem.sanitizeHtml(m.telefonnummer || '-')}</td>
          <td>
            <button class="icon-btn" title="Zuordnung entfernen" data-remove-management="${m.id}">
              ${icon('x-mark', { className: 'icon-16' })}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    return `
      ${renderSectionHeader({ title: 'Management', actionsHtml: actionButtons })}
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Straße</th>
              <th>Ort</th>
              <th>Land</th>
              <th>E-Mail</th>
              <th>Telefon</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
};
