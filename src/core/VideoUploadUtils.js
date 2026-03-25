export const MAX_VERSIONS = 3;

function sanitizeForFilename(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

export function buildVersionedFileName(creator, unternehmen, kampagne, version, ext) {
  const parts = [creator, unternehmen, kampagne]
    .map(sanitizeForFilename)
    .filter(Boolean);

  parts.push(`v${version}`);
  return parts.join('_') + '.' + ext;
}

export function getAvailableVersions(existingVersions, maxVersions = MAX_VERSIONS) {
  const all = Array.from({ length: maxVersions }, (_, i) => i + 1);
  return all.filter(v => !existingVersions.includes(v));
}
