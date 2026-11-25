// loadJsPdf.js
// jsPDF kommt per CDN, nicht aus dem Bundle. Ein Loader fuer alle
// Text-PDFs (Briefing, Skript, Produkt), damit das Skript nur einmal geholt wird.

export const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

let jsPdfPromise = null;

function loadCdnScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('PDF-Bibliothek konnte nicht geladen werden'));
    document.head.appendChild(script);
  });
}

/** Liefert den jsPDF-Konstruktor; laedt das Skript beim ersten Aufruf nach. */
export function loadJsPdf() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!jsPdfPromise) {
    jsPdfPromise = loadCdnScript(JSPDF_URL).then(() => {
      const ctor = window.jspdf?.jsPDF;
      if (!ctor) throw new Error('jsPDF ohne jsPDF-Export geladen');
      return ctor;
    }).catch((err) => {
      jsPdfPromise = null;
      throw err;
    });
  }
  return jsPdfPromise;
}
