// Zentrales Mail-System (supabase/functions/_shared/mail/): Shell, Sektionen, Templates.
// Die Netlify-Functions beziehen dieselbe Quelle über _shared/mail-system.js.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { MAIL_COLORS } from '../../supabase/functions/_shared/mail/tokens.ts';
import { esc, initialen, rich, safeUrl } from '../../supabase/functions/_shared/mail/html.ts';
import { renderShell, logoUrl } from '../../supabase/functions/_shared/mail/shell.ts';
import {
  button, infoZeilen, nachricht, schritte, text, rohHtml,
} from '../../supabase/functions/_shared/mail/sections.ts';
import {
  anschreibenMail, authMail, creatorUploadMail, einladungMail, einreichungMail, teilenMail,
  BRIEFING_SCHRITTE,
} from '../../supabase/functions/_shared/mail/index.ts';
import { kundenSteps } from '../modules/einladung/einladungFelder.js';

const require = createRequire(import.meta.url);

const BASIS = 'https://likebase.example';
const LINK = `${BASIS}/einladung/abc123`;

describe('html-Helfer', () => {
  it('esc maskiert HTML-Zeichen und Anführungszeichen', () => {
    expect(esc('<script>"x"&\'y\'</script>')).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;');
  });

  it('rich setzt fette Teile und escaped alles', () => {
    expect(rich(['Hallo ', { fett: '<b>Welt</b>' }, '\nzwei'])).toBe(
      'Hallo <strong style="font-weight:600;">&lt;b&gt;Welt&lt;/b&gt;</strong><br>zwei',
    );
  });

  it('safeUrl lässt nur http(s), mailto und Supabase-Platzhalter durch', () => {
    expect(safeUrl('https://a.de/x?y=1')).toBe('https://a.de/x?y=1');
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('data:text/html;base64,AAAA')).toBe('');
    expect(safeUrl('{{ .ConfirmationURL }}')).toBe('{{ .ConfirmationURL }}');
    expect(safeUrl('{{ .Foo }} evil')).toBe('');
  });

  it('initialen nimmt Vor- und Nachname', () => {
    expect(initialen('Oliver Mackeldanz')).toBe('OM');
    expect(initialen('Madonna')).toBe('M');
    expect(initialen('')).toBe('?');
  });
});

describe('Shell', () => {
  const shell = (extra = {}) => renderShell({ betreff: 'B', titel: 'Titel', inhalt: '<tr><td>X</td></tr>', ...extra });

  it('ist immer hell: color-scheme light, kein Dark-Block', () => {
    const html = shell();
    expect(html).toContain('<meta name="color-scheme" content="light">');
    expect(html).not.toContain('prefers-color-scheme');
    expect(html).not.toContain('light dark');
  });

  it('zeigt Preheader, Kontext und Badge nur, wenn gesetzt', () => {
    expect(shell()).not.toContain('display:none; font-size:1px');
    const html = shell({ preheader: 'Vorschau', kontext: 'Kunde AG', badge: 'Paid' });
    expect(html).toContain('Vorschau');
    expect(html).toContain('Kunde AG');
    expect(html).toContain('>Paid</span>');
  });

  it('Logo kommt über die Basis-URL, ohne gültige URL entfällt es', () => {
    expect(logoUrl(`${BASIS}/`)).toBe(`${BASIS}/apple-touch-icon.png`);
    expect(shell({ basisUrl: BASIS })).toContain(`src="${BASIS}/apple-touch-icon.png"`);
    expect(shell()).not.toContain('<img');
    expect(shell({ basisUrl: 'javascript:alert(1)' })).not.toContain('<img');
  });

  it('escaped Titel und Betreff', () => {
    const html = shell({ betreff: '<i>b</i>', titel: '<u>t</u>' });
    expect(html).not.toContain('<i>b</i>');
    expect(html).not.toContain('<u>t</u>');
  });

  it('Versandzeile: deutsch, englisch zusätzlich bei zweisprachig', () => {
    expect(shell({ imAuftragVon: 'LikeGroup' })).toContain('im Auftrag von LikeGroup');
    expect(shell({ imAuftragVon: 'LikeGroup', zweisprachig: true })).toContain('on behalf of LikeGroup');
  });
});

describe('Sektionen', () => {
  it('button: nur sichere URL, Label escaped, VML-Fallback für Outlook', () => {
    const ok = button({ label: 'Öffnen <x>', url: LINK });
    expect(ok).toContain(`href="${LINK}"`);
    expect(ok).toContain('Öffnen &lt;x&gt;');
    expect(ok).toContain('v:roundrect');
    expect(button({ label: 'X', url: 'javascript:alert(1)' })).toContain('href=""');
  });

  it('schritte: leere Liste ergibt nichts, sonst Pillen und Outlook-Textzeile', () => {
    expect(schritte({ titel: 'T', items: [] })).toBe('');
    const html = schritte({ titel: 'T', items: ['Eins', 'Zwei'] });
    expect(html).toContain('>Eins</span>');
    expect(html).toContain('1 Eins &nbsp;&middot;&nbsp; 2 Zwei');
  });

  it('infoZeilen: leere Werte entfallen, ohne Werte keine Sektion', () => {
    expect(infoZeilen([{ label: 'Kunde', wert: '' }])).toBe('');
    const html = infoZeilen([{ label: 'Kunde', wert: 'A & B' }, { label: 'Leer', wert: '' }]);
    expect(html).toContain('A &amp; B');
    expect(html).not.toContain('Leer');
  });

  it('nachricht und text escapen Eingaben', () => {
    expect(nachricht({ text: '<script>x</script>' })).not.toContain('<script>');
    expect(text('<img src=x>')).not.toContain('<img');
  });

  it('rohHtml reicht fertiges HTML unverändert durch', () => {
    expect(rohHtml('<p>Hallo</p>')).toContain('<p>Hallo</p>');
  });
});

describe('Template einladung', () => {
  const base = {
    art: 'briefing',
    briefingTyp: 'paid_creator_ads',
    absenderName: 'Oliver Mackeldanz',
    kunde: 'FORGEWORKS AG · IRONCLAD',
    code: '924113',
    link: LINK,
    basisUrl: BASIS,
  };

  it('Briefing: Code, Button, Link, Badge, Schritte, Betreff mit Kunde', () => {
    const { betreff, html } = einladungMail(base);
    expect(betreff).toBe('Bitte füllen Sie Ihr Briefing aus – FORGEWORKS AG · IRONCLAD');
    expect(html).toContain('924113');
    expect(html).toContain('Formular öffnen');
    expect(html).toContain(`href="${LINK}"`);
    expect(html).toContain('>Paid</span>');
    for (const schritt of BRIEFING_SCHRITTE) expect(html).toContain(`${schritt}</span>`);
    expect(html).toContain('Oliver Mackeldanz');
    expect(html).toContain('im Auftrag von LikeGroup');
  });

  it('Produkt: keine Schritte, kein Badge', () => {
    const { betreff, html } = einladungMail({ ...base, art: 'produkt', briefingTyp: null, kunde: undefined });
    expect(betreff).toBe('Bitte tragen Sie Ihr Produkt ein');
    expect(html).not.toContain('So ist das Formular aufgebaut');
    expect(html).not.toContain('>Paid</span>');
    expect(html).toContain('Produkt eintragen');
  });

  it('escaped Absender und Nachricht, ohne Nachricht kein Nachrichten-Block', () => {
    const mit = einladungMail({ ...base, absenderName: 'Eve <script>', nachricht: '<b>Hi</b>\nzwei' }).html;
    expect(mit).not.toContain('<script>');
    expect(mit).toContain('&lt;b&gt;Hi&lt;/b&gt;<br>zwei');
    expect(einladungMail(base).html).not.toContain('Nachricht von');
  });

  it('Schritte-Liste entspricht dem Kundenformular', () => {
    expect([...BRIEFING_SCHRITTE]).toEqual(kundenSteps().map((s) => s.label));
  });
});

describe('Template teilen', () => {
  const base = {
    entityLabel: 'Sourcing-Liste',
    entityArticle: 'die',
    entityName: 'Sommer <Edit>',
    sharedByName: 'Lisa',
    rechte: 'feedback',
    link: `${BASIS}/share/xyz`,
    code: '123456',
    basisUrl: BASIS,
  };

  it('Liste: Betreff, Rechte-Text, Button, Code', () => {
    const { betreff, html } = teilenMail(base);
    expect(betreff).toBe('Sourcing-Liste „Sommer <Edit>" wurde mit Ihnen geteilt');
    expect(html).toContain('ansehen und Feedback geben');
    expect(html).toContain('Sourcing-Liste öffnen');
    expect(html).toContain('123456');
    expect(html).not.toContain('Sommer <Edit>');
    expect(html).toContain('Sommer &lt;Edit&gt;');
  });

  it('Skript einer ganzen Kampagne', () => {
    const { betreff, html } = teilenMail({ ...base, entityLabel: 'Skript', entityArticle: 'das', allScripts: true, rechte: 'ansehen' });
    expect(betreff).toBe('Skripte der Kampagne „Sommer <Edit>" wurden mit Ihnen geteilt');
    expect(html).toContain('Skripte öffnen');
    expect(html).toContain('Sie können die Skripte ansehen.');
  });

  it('Nachricht erscheint nur, wenn sie gesetzt ist', () => {
    expect(teilenMail({ ...base, message: 'Viel Spaß' }).html).toContain('Viel Spaß');
    expect(teilenMail(base).html).not.toContain('Nachricht von');
  });
});

describe('Template einreichung', () => {
  it('Briefing: Name fett, Kunde, Button, Betreff', () => {
    const { betreff, html } = einreichungMail({
      art: 'briefing', einreicherName: 'Kim', einladungLabel: 'Briefing-Einladung', kunde: 'VHV', link: `${BASIS}/produktion/1?tab=briefing`, basisUrl: BASIS,
    });
    expect(betreff).toBe('Neues Briefing eingereicht: Briefing-Einladung');
    expect(html).toContain('Einreichung prüfen');
    expect(html).toContain('>VHV</td>');
    expect(html).toContain('ein Briefing eingereicht');
  });

  it('ohne Kunde keine Kunden-Zeile', () => {
    const { html } = einreichungMail({ art: 'produkt', einreicherName: 'Kim', einladungLabel: 'X', link: `${BASIS}/produkt` });
    expect(html).not.toContain('>Kunde<');
    expect(html).toContain('ein Produkt eingereicht');
  });
});

describe('Template creatorUpload', () => {
  const html = creatorUploadMail({
    creatorVorname: 'Lisa', kampagneName: 'Sommer', link: `${BASIS}/up#t=abc`, expiresAt: '2026-12-24T10:00:00Z', basisUrl: BASIS,
  });

  it('Deutsch zuerst, Englisch darunter', () => {
    expect(html.html.indexOf('Hallo Lisa,')).toBeLessThan(html.html.indexOf('Hi Lisa,'));
    expect(html.html.lastIndexOf('Rohmaterial hochladen')).toBeLessThan(html.html.lastIndexOf('Upload raw footage'));
    expect(html.html).toContain('Hallo Lisa,');
    expect(html.html).toContain('Hi Lisa,');
    expect(html.html).toContain('on behalf of LikeGroup');
  });

  it('Datum je Sprache, Betreff zweisprachig', () => {
    expect(html.html).toContain('24.12.2026');
    expect(html.html).toContain('24/12/2026');
    expect(html.betreff).toBe('Rohmaterial-Upload für Sommer / Raw footage upload for Sommer');
  });
});

describe('Template anschreiben', () => {
  it('Text bleibt als HTML, Betreff kommt von außen', () => {
    const { betreff, html } = anschreibenMail({ betreff: 'Briefing: Glow Up', textHtml: '<p>Hallo Lisa,</p><p>für VHV.</p>', basisUrl: BASIS });
    expect(betreff).toBe('Briefing: Glow Up');
    expect(html).toContain('<p>Hallo Lisa,</p><p>für VHV.</p>');
    expect(html).toContain('PDF');
    expect(html).not.toContain('Formular öffnen');
  });
});

describe('Template auth', () => {
  it.each(['bestaetigen', 'passwort', 'einladung'])('%s trägt die Supabase-Platzhalter', (art) => {
    const { betreff, html } = authMail(art);
    expect(betreff).toBeTruthy();
    expect(html).toContain('href="{{ .ConfirmationURL }}"');
    expect(html).toContain('src="{{ .SiteURL }}/apple-touch-icon.png"');
  });
});

describe('Farben', () => {
  it('jede Hex-Farbe in jedem Template steht in tokens.ts', () => {
    const erlaubt = new Set(Object.values(MAIL_COLORS).map((c) => c.toLowerCase()));
    const mails = [
      einladungMail({ art: 'briefing', briefingTyp: 'owned_social', absenderName: 'A', kunde: 'K', nachricht: 'N', code: '111111', link: LINK, basisUrl: BASIS }).html,
      einladungMail({ art: 'produkt', absenderName: 'A', code: '111111', link: LINK }).html,
      teilenMail({ entityLabel: 'Kampagne', entityArticle: 'die', entityName: 'K', sharedByName: 'A', rechte: 'ansehen', link: LINK, code: '111111', message: 'M' }).html,
      einreichungMail({ art: 'briefing', einreicherName: 'A', einladungLabel: 'L', kunde: 'K', link: LINK }).html,
      creatorUploadMail({ link: LINK, kampagneName: 'K', expiresAt: '2026-12-24T10:00:00Z' }).html,
      anschreibenMail({ betreff: 'B', textHtml: '<p>X</p>' }).html,
      authMail('passwort').html,
    ];
    for (const html of mails) {
      const gefunden = html.match(/#[0-9a-fA-F]{6}\b/g) || [];
      for (const hex of gefunden) expect(erlaubt.has(hex.toLowerCase()), `${hex} fehlt in tokens.ts`).toBe(true);
    }
  });
});

describe('Netlify-Brücke', () => {
  it('liefert dieselben Templates wie die Edge Functions', () => {
    const bruecke = require('../../netlify/functions/_shared/mail-system.js');
    for (const name of ['einladungMail', 'einreichungMail', 'teilenMail', 'creatorUploadMail', 'anschreibenMail', 'authMail']) {
      expect(typeof bruecke[name]).toBe('function');
    }
    const eingabe = { betreff: 'B', textHtml: '<p>X</p>', basisUrl: BASIS };
    expect(bruecke.anschreibenMail(eingabe)).toEqual(anschreibenMail(eingabe));
  });
});
