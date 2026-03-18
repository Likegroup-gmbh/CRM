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
