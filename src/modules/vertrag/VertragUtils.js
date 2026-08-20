function sanitizePath(str) {
  if (!str) return '';
  return str
    .replace(/[<>:"|?*\\/]/g, '-')
    .replace(/-{2,}/g, '-')
    .trim();
}

export class VertragUtils {

  static getVertragLinkUrl(vertrag) {
    if (!vertrag) return null;
    return vertrag.dropbox_file_url
      || vertrag.unterschriebener_vertrag_url
      || vertrag.datei_url
      || null;
  }

  static isContracting(vertrag) {
    return vertrag?.typ === 'Contracting';
  }

  /**
   * Kontext eines Vertrags: Contracting → Auftrag (/contracts/:id), sonst Kampagne.
   * Erwartet optionale Joins `contracting_auftrag` bzw. `kampagne`.
   */
  static getVertragContext(vertrag) {
    if (!vertrag) {
      return { kind: null, id: null, label: '', href: null, dataTable: null };
    }

    if (this.isContracting(vertrag)) {
      const auftrag = vertrag.contracting_auftrag || null;
      const id = auftrag?.id || vertrag.contracting_auftrag_id || null;
      const label = String(auftrag?.titel || auftrag?.auftragsname || '').trim();
      return {
        kind: 'auftrag',
        id,
        label,
        href: id ? `/contracts/${id}` : null,
        dataTable: 'contracts'
      };
    }

    const kampagne = vertrag.kampagne || null;
    const id = kampagne?.id || vertrag.kampagne_id || null;
    const label = String(kampagne?.eigener_name || kampagne?.kampagnenname || '').trim();
    return {
      kind: 'kampagne',
      id,
      label,
      href: id ? `/kampagne/${id}` : null,
      dataTable: 'kampagne'
    };
  }

  static renderVertragContextHtml(vertrag, sanitize = (s) => s) {
    const ctx = this.getVertragContext(vertrag);
    if (!ctx.id) return '-';
    const fallback = ctx.kind === 'auftrag' ? 'Contracting-Auftrag' : 'Kampagne';
    const label = sanitize(ctx.label || fallback);
    if (!ctx.href) return label;
    return `<a href="${ctx.href}" class="table-link" data-table="${ctx.dataTable}" data-id="${ctx.id}">${label}</a>`;
  }

  /**
   * Draft → Edit-Wizard. Final → PDF (generiert oder unterschrieben). Sonst nichts.
   */
  static getVertragOpenAction(vertrag) {
    if (!vertrag?.id) return { kind: 'none' };
    if (vertrag.is_draft) {
      return { kind: 'edit', href: `/vertraege/${vertrag.id}/edit` };
    }
    const url = this.getVertragLinkUrl(vertrag);
    if (url) return { kind: 'pdf', url };
    return { kind: 'none' };
  }

  static renderVertragNameHtml(vertrag, sanitize = (s) => s) {
    const name = sanitize(vertrag?.name || '—');
    const action = this.getVertragOpenAction(vertrag);
    if (action.kind === 'edit') {
      return `<a href="${action.href}" class="table-link" data-vertrag-open="edit" data-id="${vertrag.id}">${name}</a>`;
    }
    if (action.kind === 'pdf') {
      const url = sanitize(action.url);
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="table-link datei-link">${name}</a>`;
    }
    return name;
  }

  static getVertragStatus(vertrag) {
    if (!vertrag) return 'kein_vertrag';

    if (vertrag.dropbox_file_url || vertrag.unterschriebener_vertrag_url) {
      return 'unterschrieben';
    }
    if (vertrag.is_draft) return 'entwurf';
    if (vertrag.datei_url) return 'erstellt';

    return 'kein_vertrag';
  }

  static shouldShowVertragstyp(vertraege, creatorId) {
    if (!vertraege || !vertraege.length) return false;

    const typen = new Set(
      vertraege
        .filter(v => v.creator_id === creatorId && v.typ)
        .map(v => v.typ)
    );

    return typen.size > 1;
  }

  static buildDropboxVertragPath({ unternehmen, kampagne, creator, vertragstyp, fileName } = {}) {
    const parts = ['/Vertraege'];
    if (unternehmen) parts.push(sanitizePath(unternehmen));
    if (kampagne) parts.push(sanitizePath(kampagne));
    if (creator) parts.push(sanitizePath(creator));
    if (vertragstyp) parts.push(sanitizePath(vertragstyp));

    const name = sanitizePath(fileName) || `Vertrag_${Date.now()}.pdf`;
    parts.push(name);

    return parts.join('/');
  }
}
