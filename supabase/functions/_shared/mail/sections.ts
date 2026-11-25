/**
 * Mail-System: Sektionen.
 *
 * Bausteine, die ein Template beliebig kombiniert. Jede Sektion liefert eine
 * Zeile (<tr>) der Karte und escaped alle Eingaben selbst. Nur rohHtml nimmt
 * fertiges HTML (ausschließlich für bereits escapten Freitext, siehe anschreiben).
 *
 * Der Abstand nach oben (Parameter `oben`, Pixel) liegt an der Sektion, nicht an der
 * Karte. Die Karte hat oben bewusst nur 12 px Innenabstand: die erste Sektion bringt
 * ihre 20 px selbst mit.
 */

import { MAIL_COLORS as C, MAIL_FONT } from './tokens.ts';
import { esc, initialen, rich, safeUrl } from './html.ts';
import type { RichText } from './html.ts';

function zeile(inhalt: string, oben: number): string {
  return `                <tr><td style="padding-top:${oben}px;">${inhalt}</td></tr>`;
}

/** Wer die Mail ausgelöst hat: Initialen-Kreis, Name, Firma, Satz dazu. */
export function absender(p: { name: string; firma?: string; text: RichText; initialen?: string; oben?: number }): string {
  const kuerzel = esc(p.initialen || initialen(p.name));
  const firma = p.firma
    ? `&nbsp;&nbsp;<span style="font-size:12px; color:${C.textGedaempft};">${esc(p.firma)}</span>`
    : '';
  return zeile(`<table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="40" valign="middle" style="width:40px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td width="40" height="40" align="center" valign="middle" style="width:40px; height:40px; border-radius:999px; background:${C.flaeche}; color:${C.textLeise}; font-family:${MAIL_FONT}; font-size:13px; line-height:40px; font-weight:600;">${kuerzel}</td>
                            </tr>
                          </table>
                        </td>
                        <td valign="middle" style="padding-left:12px;">
                          <div style="font-size:15px; line-height:20px;"><span style="font-weight:600; color:${C.textStark};">${esc(p.name)}</span>${firma}</div>
                          <div style="padding-top:2px; font-size:13px; line-height:18px; color:${C.textGedaempft};">${rich(p.text)}</div>
                        </td>
                      </tr>
                    </table>`, p.oben ?? 20);
}

/** Abschnittstitel mit optionaler Zeile darunter. */
export function ueberschrift(p: { titel: string; text?: RichText; oben?: number }): string {
  const text = p.text
    ? `<div style="padding-top:4px; font-size:14px; line-height:21px; color:${C.textGedaempft};">${rich(p.text)}</div>`
    : '';
  return zeile(`<div style="font-size:17px; line-height:24px; font-weight:600; color:${C.textStark};">${esc(p.titel)}</div>${text}`, p.oben ?? 20);
}

/** Fließtext. `leise` ist die graue, kleinere Variante. */
export function text(inhalt: RichText, opt: { leise?: boolean; oben?: number } = {}): string {
  const style = opt.leise
    ? `font-size:13px; line-height:19px; color:${C.textGedaempft};`
    : `font-size:15px; line-height:23px; color:${C.textBody};`;
  return zeile(`<div style="${style}">${rich(inhalt)}</div>`, opt.oben ?? 20);
}

/** Zitierter Block, z. B. die persönliche Nachricht des Absenders. */
export function nachricht(p: { titel?: string; text: string; oben?: number }): string {
  const titel = p.titel
    ? `<div style="padding-bottom:4px; font-size:12px; line-height:18px; font-weight:600; color:${C.textGedaempft};">${esc(p.titel)}</div>`
    : '';
  return zeile(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.feld}; border:1px solid ${C.rand}; border-radius:10px; border-collapse:separate;">
                      <tr>
                        <td style="padding:14px 18px;">
                          ${titel}<div style="font-size:14px; line-height:21px; color:${C.textStark};">${rich(p.text)}</div>
                        </td>
                      </tr>
                    </table>`, p.oben ?? 20);
}

/** Code im Eingabefeld-Stil, in großen Ziffern. */
export function codeFeld(p: { label: string; code: string; oben?: number }): string {
  return zeile(`<div style="padding-bottom:8px; font-size:14px; line-height:20px; font-weight:500; color:${C.textStark};">${esc(p.label)}</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.feld}; border:1px solid ${C.rand}; border-radius:10px; border-collapse:separate;">
                      <tr>
                        <td style="padding:14px 18px;">
                          <span class="code" style="font-size:30px; line-height:36px; font-weight:600; letter-spacing:8px; color:${C.textStark}; font-variant-numeric:tabular-nums;">${esc(p.code)}</span>
                        </td>
                      </tr>
                    </table>`, p.oben ?? 20);
}

/** Schwarze Pille. Outlook (Windows) bekommt einen VML-Button. */
export function button(p: { label: string; url: string; oben?: number }): string {
  const url = esc(safeUrl(p.url));
  const label = esc(p.label);
  const breite = Math.max(170, Math.min(420, p.label.length * 10 + 60));
  return zeile(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn-table">
                      <tr>
                        <td>
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:44px; v-text-anchor:middle; width:${breite}px;" arcsize="50%" stroke="f" fillcolor="${C.knopf}">
                            <w:anchorlock/>
                            <center style="color:${C.knopfText}; font-family:Arial, sans-serif; font-size:15px; font-weight:bold;">${label}</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a href="${url}" class="btn" style="display:inline-block; padding:0 26px; border-radius:999px; background:${C.knopf}; color:${C.knopfText}; font-family:${MAIL_FONT}; font-size:15px; line-height:44px; font-weight:600; text-decoration:none;">${label}</a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>`, p.oben ?? 24);
}

/** Schritte als Pillen, wie der Stepper im Formular. Outlook zeigt eine Textzeile. */
export function schritte(p: { titel: string; text?: string; items: string[]; aktiv?: number; oben?: number }): string {
  if (p.items.length === 0) return '';
  const aktiv = p.aktiv ?? 0;
  const pillen = p.items.map((label, i) => {
    const an = i === aktiv;
    return `<span style="display:inline-block; margin:0 6px 8px 0; padding:5px 12px 5px 5px; border:1px solid ${an ? C.textStark : C.rand}; border-radius:999px; font-size:13px; line-height:20px; ${an ? 'font-weight:600;' : ''} color:${an ? C.textStark : C.textBody}; white-space:nowrap;"><span style="display:inline-block; width:20px; height:20px; margin-right:7px; border-radius:999px; background:${an ? C.knopf : C.flaeche}; color:${an ? C.knopfText : C.textGedaempft}; font-size:11px; line-height:20px; font-weight:600; text-align:center;">${i + 1}</span>${esc(label)}</span>`;
  }).join('\n                      ');
  const outlook = p.items.map((label, i) => `${i + 1} ${esc(label)}`).join(' &nbsp;&middot;&nbsp; ');
  const text = p.text
    ? `<div style="padding:2px 0 14px; font-size:13px; line-height:18px; color:${C.textGedaempft};">${esc(p.text)}</div>`
    : '<div style="padding-bottom:14px;"></div>';
  return zeile(`<div style="font-size:14px; line-height:20px; font-weight:500; color:${C.textStark};">${esc(p.titel)}</div>
                    ${text}
                    <!--[if mso]>
                    <p style="margin:0; font-size:13px; line-height:20px; color:${C.textBody};">${outlook}</p>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <div style="font-size:0; line-height:0;">
                      ${pillen}
                    </div>
                    <!--<![endif]-->`, p.oben ?? 0);
}

/** Beschriftete Werte untereinander, z. B. Kunde und gültig bis. */
export function infoZeilen(zeilen: Array<{ label: string; wert: string }>, opt: { oben?: number } = {}): string {
  const rows = zeilen.filter((z) => z.wert).map((z) => `<tr>
                        <td valign="top" style="padding:3px 16px 3px 0; font-size:13px; line-height:20px; color:${C.textGedaempft}; white-space:nowrap;">${esc(z.label)}</td>
                        <td valign="top" style="padding:3px 0; font-size:14px; line-height:20px; font-weight:500; color:${C.textStark};">${esc(z.wert)}</td>
                      </tr>`).join('\n                      ');
  if (!rows) return '';
  return zeile(`<table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      ${rows}
                    </table>`, opt.oben ?? 20);
}

/** Dünne Linie zwischen zwei Abschnitten. */
export function trenner(p: { oben?: number; unten?: number } = {}): string {
  return `                <tr><td style="padding:${p.oben ?? 28}px 0 ${p.unten ?? 4}px;"><div style="height:1px; line-height:1px; font-size:1px; background:${C.rand};">&nbsp;</div></td></tr>`;
}

/**
 * Fertiges HTML, ungeprüft. Nur für Inhalte, die schon escaped sind
 * (Anschreiben: textToHtml). Alles andere läuft über die Sektionen oben.
 */
export function rohHtml(html: string, opt: { oben?: number } = {}): string {
  return zeile(`<div class="roh" style="font-size:15px; line-height:23px; color:${C.textBody};">${html}</div>`, opt.oben ?? 20);
}

/** Fußzeile: Link zum Kopieren, falls der Button nicht geht. */
export function fallbackLink(p: { intro: string; url: string }): string {
  const url = safeUrl(p.url);
  if (!url) return '';
  return `<div style="font-size:12px; line-height:18px; color:${C.textGedaempft};">
                ${esc(p.intro)}<br>
                <a href="${esc(url)}" class="link" style="color:${C.link}; word-break:break-all;">${esc(url)}</a>
              </div>`;
}

/** Fußzeile: kurzer Hinweis, z. B. "Antworten Sie einfach auf diese E-Mail." */
export function fussHinweis(inhalt: RichText, opt: { oben?: number } = {}): string {
  return `<div style="padding-top:${opt.oben ?? 16}px; font-size:12px; line-height:18px; color:${C.textGedaempft};">${rich(inhalt)}</div>`;
}
