/**
 * Mail-System: Grundgerüst.
 *
 * Kopf (Logo, Kontext, Titel, Badge), Karte, Fußzeile, Mobile-Regeln und
 * Outlook-Fallbacks. Die Shell kennt keine Bereiche: der Inhalt kommt als fertige
 * Sektionen (sections.ts) von den Templates.
 *
 * Immer hell. Die Plattform hat keinen Dark Mode, color-scheme ist auf light fixiert.
 */

import { MAIL_BREITE, MAIL_COLORS as C, MAIL_FONT, MAIL_MARKE } from './tokens.ts';
import { esc, safeUrl } from './html.ts';

export interface ShellOptions {
  sprache?: 'de' | 'en';
  /** <title> der Mail. */
  betreff: string;
  /** Vorschautext im Posteingang. */
  preheader?: string;
  /** Graue Zeile über dem Titel, z. B. Kunde und Marke. */
  kontext?: string;
  titel: string;
  /** Kleine Pille hinter dem Titel, z. B. "Paid". */
  badge?: string;
  /** Sektionen (Zeilen der Karte), siehe sections.ts. */
  inhalt: string;
  /** Fußzeilen-Blöcke (sections.ts: fallbackLink, fussHinweis). */
  footer?: string;
  /** "im Auftrag von X" in der letzten Fußzeile. */
  imAuftragVon?: string;
  /** Versandzeile zusätzlich auf Englisch (Creator-Mails). */
  zweisprachig?: boolean;
  /** Basis-URL der Plattform. Ohne gültige URL entfällt das Logo. */
  basisUrl?: string;
}

const TEXTE = {
  de: { gesendet: 'Gesendet über', imAuftrag: 'im Auftrag von' },
  en: { gesendet: 'Sent via', imAuftrag: 'on behalf of' },
} as const;

function versandzeile(sprache: 'de' | 'en', imAuftragVon?: string): string {
  const t = TEXTE[sprache];
  const imAuftrag = imAuftragVon ? ` ${t.imAuftrag} ${esc(imAuftragVon)}` : '';
  return `${t.gesendet} <span style="font-weight:600; color:${C.textBody};">${esc(MAIL_MARKE.produkt)}</span>${imAuftrag}.`;
}

export function logoUrl(basisUrl?: string): string {
  const basis = safeUrl(basisUrl).replace(/\/+$/, '');
  return basis ? `${basis}${MAIL_MARKE.logoPfad}` : '';
}

const STYLE = `
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    body { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; -webkit-font-smoothing: antialiased; }
    table, td { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; display: block; }
    a { text-decoration: none; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    .btn:hover { background: ${C.knopfHover} !important; }
    .link:hover { text-decoration: underline !important; }
    .roh p { margin: 0 0 14px 0; }
    .roh p:last-child { margin-bottom: 0; }
    @media only screen and (max-width: 620px) {
      .wrap { padding: 24px 12px !important; }
      .container { width: 100% !important; }
      .card-pad { padding: 4px 20px 24px !important; }
      .title { font-size: 20px !important; line-height: 26px !important; }
      .code { font-size: 26px !important; letter-spacing: 7px !important; }
      .btn-table { width: 100% !important; }
      .btn { display: block !important; text-align: center !important; }
    }`;

function kopf(o: ShellOptions): string {
  const logo = logoUrl(o.basisUrl);
  const logoZelle = logo
    ? `<td width="40" valign="middle" style="width:40px;">
                    <img src="${esc(logo)}" width="40" height="40" alt="${esc(MAIL_MARKE.produkt)}" style="width:40px; height:40px; border-radius:10px; background:${C.knopf}; color:${C.knopfText}; font-family:Arial, sans-serif; font-size:9px; line-height:40px; text-align:center;">
                  </td>`
    : '';
  const kontext = o.kontext
    ? `<div style="font-family:${MAIL_FONT}; font-size:13px; line-height:18px; color:${C.textGedaempft};">${esc(o.kontext)}</div>`
    : '';
  const badge = o.badge
    ? `
                      <span style="display:inline-block; vertical-align:middle; margin-left:6px; padding:2px 9px; border-radius:999px; background:${C.badgeHintergrund}; color:${C.badgeText}; font-size:12px; line-height:18px; font-weight:500; letter-spacing:0;">${esc(o.badge)}</span>`
    : '';
  return `<tr>
            <td style="padding:0 0 20px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${logoZelle}
                  <td valign="middle" style="${logo ? 'padding-left:14px;' : ''}">
                    ${kontext}
                    <div class="title" style="font-family:${MAIL_FONT}; font-size:22px; line-height:28px; font-weight:700; letter-spacing:-0.2px; color:${C.textStark};">
                      ${esc(o.titel)}${badge}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

export function renderShell(o: ShellOptions): string {
  const sprache = o.sprache ?? 'de';
  const preheader = o.preheader
    ? `<div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">${esc(o.preheader)}</div>
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>`
    : '';
  const versand = versandzeile(sprache, o.imAuftragVon)
    + (o.zweisprachig ? `<br>${versandzeile(sprache === 'de' ? 'en' : 'de', o.imAuftragVon)}` : '');

  return `<!DOCTYPE html>
<html lang="${sprache}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${esc(o.betreff)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <style>table, td, div, p, a, span { font-family: Arial, Helvetica, sans-serif !important; }</style>
  <![endif]-->
  <!--[if !mso]><!-->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <!--<![endif]-->
  <style>
    :root { color-scheme: light; supported-color-schemes: light; }${STYLE}
  </style>
</head>
<body style="margin:0; padding:0; background:${C.seite};">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.seite};">
    <tr>
      <td align="center" class="wrap" style="padding:40px 16px;">
        <!--[if mso]><table role="presentation" width="${MAIL_BREITE}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="container" style="max-width:${MAIL_BREITE}px; width:100%; border-collapse:separate;">
          ${kopf(o)}
          <tr>
            <td class="card-pad" style="background:${C.karte}; border:1px solid ${C.rand}; border-radius:12px; padding:12px 32px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${MAIL_FONT};">
${o.inhalt}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 4px 0; font-family:${MAIL_FONT};">
              ${o.footer ?? ''}
              <div style="padding-top:${o.footer ? '16' : '0'}px; font-size:12px; line-height:18px; color:${C.textGedaempft};">
                ${versand}
              </div>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}
