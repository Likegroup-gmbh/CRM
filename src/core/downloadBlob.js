// downloadBlob.js
// Eine lokal erzeugte Datei (z.B. ein PDF-Blob) per Anchor-Klick herunterladen.

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = String(filename || 'download').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'download';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
