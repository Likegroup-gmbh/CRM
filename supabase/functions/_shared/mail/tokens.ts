/**
 * Mail-System: Design-Tokens.
 *
 * Die einzige Stelle für Farben, Schrift und Maße aller Plattform-Mails.
 * Jeder Wert ist an die CSS-Variable aus assets/styles/variables.css gebunden.
 * Mails können keine CSS-Variablen auflösen, deshalb stehen hier die Hex-Werte.
 * Ändert sich dort etwas, wird es hier einmal nachgezogen.
 *
 * Reines TypeScript ohne Deno- oder Node-Globals: Edge Functions, Netlify-Functions
 * und Vitest importieren dieselbe Datei.
 */

export const MAIL_COLORS = {
  /** --bg-secondary (gray-50): Seitenhintergrund */
  seite: '#fafafa',
  /** --bg-primary: Karte */
  karte: '#ffffff',
  /** gray-200: Rahmen der Karte, Trenner, Pillen */
  rand: '#e5e5e5',
  /** gray-50: Code-Feld, Nachrichten-Block */
  feld: '#fafafa',
  /** gray-100: Avatar-Kreis, Zahl in inaktiver Pille */
  flaeche: '#f5f5f5',
  /** --text-primary (gray-900) */
  textStark: '#171717',
  /** gray-700 */
  textBody: '#404040',
  /** gray-600: Initialen im Avatar */
  textLeise: '#525252',
  /** --text-tertiary (gray-500) */
  textGedaempft: '#737373',
  /** --color-primary (gray-900): schwarze Pille */
  knopf: '#171717',
  /** gray-700: Hover */
  knopfHover: '#404040',
  /** --text-inverse */
  knopfText: '#ffffff',
  /** --primary-50 */
  badgeHintergrund: '#eff6ff',
  /** --primary-600 */
  badgeText: '#2563eb',
  /** --text-link (primary-600) */
  link: '#2563eb',
} as const;

/** --font-sans: Inter, mit System-Fallback für Mail-Clients ohne Webfont. */
export const MAIL_FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Breite der Karte in Pixel (Outlook braucht eine feste Zahl). */
export const MAIL_BREITE = 560;

/** Namen, die in jeder Mail vorkommen. */
export const MAIL_MARKE = {
  produkt: 'LikeBase',
  firma: 'LikeGroup',
  /** Liegt in public/ und wird über die Basis-URL der Plattform geladen. */
  logoPfad: '/apple-touch-icon.png',
} as const;
