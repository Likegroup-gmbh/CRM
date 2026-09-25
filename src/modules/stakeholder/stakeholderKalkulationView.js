// Kalkulationskarten und Kundenliste der Stakeholder-Übersicht.

import { icon } from '../../core/icons/IconSystem.js';
import { aggregate, influencerOffenesCreatorBudget, kartenSummen } from './stakeholderOverviewData.js';
import {
  TAB_INFLUENCER,
  groupRowsByKundeMarke,
  groupTypBadges,
  groupZeitraum,
} from './stakeholderOverviewLogic.js';

const CARD_HINTS = {
  volumen: {
    formula: 'Σ Nettobetrag aller Aufträge',
    hint: 'Gestellt, Bezahlt und Unbezahlt aus den Kundenrechnungen. Überfällig steckt in Unbezahlt. Noch nicht gestellt = Auftragsvolumen − Gestellt.'
  },
  verbraucht: {
    formula: 'Creatoranteil + Agenturanteil + KSK + Zusatzkosten',
    hint: 'alles, was bereits gebucht ist'
  },
  verfuegbar: {
    formula: 'Auftragsvolumen − Verbrauchtes Budget',
    hint: 'noch nicht gebucht'
  },
  offenCreator: {
    formula: 'Creator-Budget − gebuchte VK',
    hint: 'noch nicht gebuchtes Creator-Budget'
  },
  creator: {
    formula: 'Σ Einkaufspreise (EK) der gebuchten Videos',
    hint: 'Kopfwert ist die Kalkulation. Netto, Bezahlt und Unbezahlt kommen aus den Rechnungen. Überfällig steckt in Unbezahlt. Noch nicht gestellt = Creatoranteil − Rechnungs-Netto.'
  },
  festAgentur: {
    formula: 'Hinterlegte Agentur-Fee',
    hint: 'Entspricht vereinfacht Auftragsvolumen − Creator-Kosten. KSK und Zusatzkosten bleiben außen. Angezeigt wird die hinterlegte Fee, nicht eine neu gerechnete Differenz.'
  },
  ekvkAgentur: {
    formula: 'Gebuchter VK − zugehöriger EK',
    hint: 'Gilt für alle Aufträge, auch wenn zusätzlich eine Fee hinterlegt ist. Nur Zeilen mit beiden Preisen. Unvollständig bepreiste Zeilen bleiben im gebuchten VK, zählen aber nicht als realisiert.'
  },
  ksk: {
    formula: 'UGC: 4,9 % auf EK · Influencer: KSK-Topf',
    hint: 'Künstlersozialabgabe auf Honorare'
  },
  zusatz: {
    formula: 'Σ Zusatzkosten der Kooperationen',
    hint: 'Reise, Lizenzen, Tools, Versand, Payroll'
  }
};

export function renderAgenturZelle(page, earned, voll) {
  const total = Number(voll) || 0;
  const pct = total > 0 ? ((Number(earned) || 0) / total) * 100 : null;
  return `
    <div class="stakeholder-agentur">
      <div class="stakeholder-agentur-top">
        <span>${page.fmtEuro(earned)}</span>
        ${pct != null ? `<span class="stakeholder-agentur-pct">${page.fmtPct(pct)}</span>` : ''}
      </div>
      <div class="stakeholder-agentur-meta">von ${page.fmtEuro(total)}</div>
    </div>
  `;
}

export function renderKalkulationBody(page) {
  const { rows, totals } = aggregate(page);
  const isInfluencerTab = page.activeTab === TAB_INFLUENCER;
  return `${renderCards(page, totals, isInfluencerTab)}${renderKundenListe(page, rows, totals, isInfluencerTab)}`;
}

export function renderCards(page, totals, isInfluencerTab) {
  const volumen = totals.volumen;
  const verbraucht = totals.verbraucht;
  const verfuegbar = totals.verfuegbar;
  const creator = totals.creator;
  const ksk = totals.ksk;
  const zusatz = totals.zusatz;

  // Ungeklemmt: ueber 100 % bedeutet Ueberschreitung, unter 0 % Ueberzahlung.
  // Die Balkenbreite wird erst beim Rendern begrenzt.
  const verbrauchtPct = volumen > 0 ? (verbraucht / volumen) * 100 : 0;
  const offenPct = volumen > 0 ? 100 - verbrauchtPct : 0;

  const offenLabel = isInfluencerTab ? 'Offenes Creator Budget' : 'Verfügbares Budget';
  const offenSub = isInfluencerTab ? 'noch nicht gebucht' : 'noch nicht gebucht';
  const offenValue = isInfluencerTab
    ? influencerOffenesCreatorBudget(page)
    : verfuegbar;
  const offenHint = isInfluencerTab ? CARD_HINTS.offenCreator : CARD_HINTS.verfuegbar;

  const cardHead = (label, hint) => `
    <div class="stakeholder-card-head">
      <div class="stakeholder-card-label">${label}</div>
      ${hint ? `
        <button type="button" class="stakeholder-card-info" aria-label="Berechnung">
          ${icon('question-mark-circle', { stroke: 1, size: 16 })}
          <span class="stakeholder-card-tooltip" role="tooltip">
            <strong>${page.escape(hint.formula)}</strong>
            <span>${page.escape(hint.hint)}</span>
          </span>
        </button>` : ''}
    </div>`;

  const metricBlock = (label, value, sub, foot, opts = {}) => `
    <div class="stakeholder-card-block">
      ${cardHead(label, opts.hint)}
      <div class="stakeholder-card-value">${page.fmtEuro(value)}</div>
      ${sub ? `<div class="stakeholder-card-sub">${sub}</div>` : ''}
      ${opts.progress != null ? `
        <div class="stakeholder-progress">
          <div class="stakeholder-progress-fill${opts.progressClass ? ` ${opts.progressClass}` : ''}" style="width: ${Math.min(100, Math.max(0, opts.progress))}%"></div>
        </div>` : ''}
      ${foot ? `<div class="stakeholder-card-foot">${foot}</div>` : ''}
    </div>`;

  const breakdownLine = (label, value, { cls = '', attr = '', negativ = false, info = '' } = {}) => {
    const classes = ['stakeholder-card-breakdown-line', cls].filter(Boolean).join(' ');
    const wertCls = negativ ? ' class="stakeholder-negativ"' : '';
    const data = attr ? ` ${attr}` : '';
    const infoBtn = info ? `
      <button type="button" class="stakeholder-card-info stakeholder-card-info--inline" aria-label="${page.escape(label)}">
        ${icon('question-mark-circle', { stroke: 1, size: 14 })}
        <span class="stakeholder-card-tooltip" role="tooltip">${page.escape(info)}</span>
      </button>` : '';
    return `<div class="${classes}"><span>${label}</span><span class="stakeholder-card-breakdown-end"><span${wertCls}${data}>${value}</span>${infoBtn}</span></div>`;
  };

  const breakdownCard = (label, value, sub, lines, foot, opts = {}) => `
    <div class="stakeholder-card">
      ${cardHead(label, opts.hint)}
      <div class="stakeholder-card-value">${page.fmtEuro(value)}</div>
      ${sub ? `<div class="stakeholder-card-sub">${sub}</div>` : ''}
      ${lines?.length ? `
        <div class="stakeholder-card-breakdown">
          ${lines.map(l => typeof l === 'string'
            ? l
            : `<div class="stakeholder-card-breakdown-line"><span>${l[0]}</span><span>${l[1]}</span></div>`).join('')}
        </div>` : ''}
      ${opts.progress != null ? `
        <div class="stakeholder-progress">
          <div class="stakeholder-progress-fill${opts.progressClass ? ` ${opts.progressClass}` : ''}" style="width: ${Math.min(100, Math.max(0, opts.progress))}%"></div>
        </div>` : ''}
      ${foot ? `<div class="stakeholder-card-foot">${foot}</div>` : ''}
    </div>`;

  // Zahlungszeilen aus den Kacheln: Creator aus Rechnungen, Volumen aus Kundenrechnungen.
  const karten = kartenSummen(page);
  const creatorKarten = karten.creator;
  const creatorNetto = creatorKarten.nettobetrag || 0;
  const creatorBezahlt = creatorKarten.bezahlt_netto || 0;
  const creatorUnbezahlt = creatorKarten.unbezahlt_netto || 0;
  const creatorUeberfaellig = creatorKarten.ueberfaellig_netto || 0;
  // Kalkulierter Creatoranteil abzüglich bereits erfasster Rechnungen.
  // Rechnungen ohne gestellt_am stecken schon im Netto; der Rest der
  // Kalkulation steht in keiner Zeile und wäre sonst 0.
  const creatorNichtGestellt = creator - creatorNetto;
  const creatorOffenLines = [
    breakdownLine('Netto', page.fmtEuro(creatorNetto), {
      attr: 'data-creator-netto',
    }),
    breakdownLine('Bezahlt', page.fmtEuro(creatorBezahlt), {
      cls: 'stakeholder-card-breakdown-line--sub',
      attr: 'data-creator-bezahlt',
    }),
    breakdownLine('Unbezahlt', page.fmtEuro(creatorUnbezahlt), {
      cls: 'stakeholder-card-breakdown-line--sub',
      attr: 'data-creator-unbezahlt',
      negativ: creatorUnbezahlt < -0.005,
    }),
    breakdownLine('davon überfällig', page.fmtEuro(creatorUeberfaellig), {
      cls: 'stakeholder-card-breakdown-line--deep stakeholder-status-ueberfaellig',
      attr: 'data-creator-ueberfaellig',
    }),
    breakdownLine('Noch nicht gestellt', page.fmtEuro(creatorNichtGestellt), {
      attr: 'data-creator-nicht-gestellt',
      negativ: creatorNichtGestellt < -0.005,
    }),
  ];

  // Auftragsvolumen-Zahlungszeilen nur aus Kundenrechnungen.
  const kundenKarten = karten.kunden;
  const kGestellt = kundenKarten.re_datum_netto || 0;
  const kBezahlt = kundenKarten.bezahlt_netto || 0;
  const kUnbezahlt = kundenKarten.unbezahlt_netto || 0;
  const kUeberfaellig = kundenKarten.ueberfaellig_netto || 0;
  // Auftragsnetto abzüglich gestellter Kundenrechnungszeilen. Teilrechnungen
  // ersetzen in der Liste nur den fakturierten Teil; der offene Rest des
  // Auftrags steht in keiner Zeile und wäre sonst 0.
  const kNichtGestellt = volumen - kGestellt;
  const gestelltPct = volumen > 0 ? (kGestellt / volumen) * 100 : 0;
  const volumenLines = [
    breakdownLine('Gestellt', page.fmtEuro(kGestellt), {
      cls: 'stakeholder-card-breakdown-line--part',
      attr: 'data-volumen-gestellt',
    }),
    breakdownLine('Bezahlt', page.fmtEuro(kBezahlt), {
      cls: 'stakeholder-card-breakdown-line--sub',
      attr: 'data-volumen-bezahlt',
    }),
    breakdownLine('Unbezahlt', page.fmtEuro(kUnbezahlt), {
      cls: 'stakeholder-card-breakdown-line--sub',
      attr: 'data-volumen-unbezahlt',
      negativ: kUnbezahlt < -0.005,
    }),
    breakdownLine('davon überfällig', page.fmtEuro(kUeberfaellig), {
      cls: 'stakeholder-card-breakdown-line--deep stakeholder-status-ueberfaellig',
      attr: 'data-volumen-ueberfaellig',
    }),
    breakdownLine('Noch nicht gestellt', page.fmtEuro(kNichtGestellt), {
      attr: 'data-volumen-nicht-gestellt',
      negativ: kNichtGestellt < -0.005,
    }),
  ];

  const progressClass = (pct) => pct >= 90 ? 'stakeholder-progress-fill--danger' : pct >= 75 ? 'stakeholder-progress-fill--warning' : '';
  const openProgressClass = (pct) => pct <= 10 ? 'stakeholder-progress-fill--danger' : pct <= 25 ? 'stakeholder-progress-fill--warning' : 'stakeholder-progress-fill--success';

  return `
    <div class="stakeholder-cards stakeholder-cards--kalkulation">
      ${breakdownCard('Auftragsvolumen = Budget', volumen, `${page.fmtEuro(kGestellt)} von ${page.fmtEuro(volumen)} gestellt`, volumenLines, `${page.fmtPct(gestelltPct)} gestellt`, { progress: gestelltPct, hint: CARD_HINTS.volumen })}
      <div class="stakeholder-card stakeholder-card--stack">
        ${metricBlock('Verbrauchtes Budget', verbraucht, 'aufgeschlüsselt in der Zeile darunter', `${page.fmtPct(verbrauchtPct)} des Budgets`, { progress: verbrauchtPct, progressClass: progressClass(verbrauchtPct), hint: CARD_HINTS.verbraucht })}
        ${metricBlock(offenLabel, offenValue, offenSub, `${page.fmtPct(offenPct)} offen`, { progress: offenPct, progressClass: openProgressClass(offenPct), hint: offenHint })}
      </div>
    </div>
    <div class="stakeholder-cards stakeholder-cards--breakdown">
      ${breakdownCard('Creatoranteil', creator, `${page.fmtEuro(creatorBezahlt)} von ${page.fmtEuro(creatorNetto)} Rechnungs-Netto bezahlt`, creatorOffenLines, `${page.fmtPct(verbraucht > 0 ? (creator / verbraucht) * 100 : 0)} · gebucht`, { progress: verbraucht > 0 ? (creator / verbraucht) * 100 : 0, hint: CARD_HINTS.creator })}
      ${breakdownCard('Fest vereinbarter Agenturanteil', totals.festAgentur, null, [
        ['Gesamtauftragsvolumen', page.fmtEuro(totals.festVolumen)]
      ], null, { hint: CARD_HINTS.festAgentur })}
      ${breakdownCard('Agenturanteil aus EK-/VK-Differenz', totals.ekvkRealisiert, null, [
        ['Gesamtauftragsvolumen', page.fmtEuro(totals.ekvkVolumen)],
        ['Bereits gebuchtes VK-Volumen', page.fmtEuro(totals.ekvkVk)]
      ], null, { hint: CARD_HINTS.ekvkAgentur })}
      ${breakdownCard('KSK-Abgabe', ksk, 'Künstlersozialabgabe auf Honorare', null, `${page.fmtPct(verbraucht > 0 ? (ksk / verbraucht) * 100 : 0)} · gebucht`, { progress: verbraucht > 0 ? (ksk / verbraucht) * 100 : 0, hint: CARD_HINTS.ksk })}
      ${breakdownCard('Zusatzkosten', zusatz, 'Reise, Lizenzen, Tools, Versand, Payroll', null, `${page.fmtPct(verbraucht > 0 ? (zusatz / verbraucht) * 100 : 0)} · gebucht`, { progress: verbraucht > 0 ? (zusatz / verbraucht) * 100 : 0, hint: CARD_HINTS.zusatz })}
    </div>
  `;
}

export function renderKundenListe(page, rows, totals, isInfluencerTab) {
  if (rows.length === 0) {
    return `
      <div class="stakeholder-list-card">
        <div class="stakeholder-empty">Keine Aufträge im gewählten Zeitraum und Tab.</div>
      </div>
    `;
  }

  const grouped = groupRowsByKundeMarke(rows);

  const rowsHtml = grouped.map((g, i) => {
    const unternehmen = page.unternehmenById.get(g.unternehmenId);
    const name = unternehmen?.firmenname || 'Ohne Unternehmen';
    const countLabel = g.count === 1 ? '1 Auftrag' : `${g.count} Aufträge`;
    const zeitraum = groupZeitraum(g.starts, g.endes);
    const badges = groupTypBadges(g);
    const badgesHtml = badges.map(b =>
      `<span class="stakeholder-badge${b.fee ? ' stakeholder-badge--fee' : ''}">${b.label}</span>`
    ).join('');

    const verbrauchtPct = g.volumen > 0 ? Math.min(100, (g.verbraucht / g.volumen) * 100) : 0;
    const offenValue = g.verfuegbar;

    return `
      <tr>
        <td class="stakeholder-num">${i + 1}</td>
        <td>
          <div class="stakeholder-kunde">
            <span class="stakeholder-kunde-name">${page.escape(name)}</span>
            <span class="stakeholder-kunde-meta">${page.escape(countLabel)} · ${page.escape(zeitraum)}</span>
          </div>
        </td>
        <td>${page.escape(g.markeName)}</td>
        <td><div class="stakeholder-badges">${badgesHtml}</div></td>
        <td class="stakeholder-num">${page.fmtEuro(g.volumen)}</td>
        <td>
          <div class="stakeholder-verbraucht">
            <div class="stakeholder-verbraucht-top">
              <span>${page.fmtEuro(g.verbraucht)}</span>
              <span class="stakeholder-verbraucht-pct">${page.fmtPct(verbrauchtPct)}</span>
            </div>
            <div class="stakeholder-progress">
              <div class="stakeholder-progress-fill" style="width: ${verbrauchtPct}%"></div>
            </div>
          </div>
        </td>
        <td class="stakeholder-num">${page.fmtEuro(offenValue)}</td>
        <td class="stakeholder-num">${page.fmtEuro(g.creator)}</td>
        <td>${renderAgenturZelle(page, g.agentur, g.agenturVoll)}</td>
        <td class="stakeholder-num">${page.fmtEuro(g.ksk)}</td>
        <td class="stakeholder-num">${page.fmtEuro(g.zusatz)}</td>
      </tr>
    `;
  }).join('');

  const kundenLabel = grouped.length === 1 ? '1 Kunde' : `${grouped.length} Kunden`;

  return `
    <div class="stakeholder-list-card">
      <div class="stakeholder-list-header">
        <h3 class="stakeholder-list-title">Kunden nach Umsatz</h3>
        <p class="stakeholder-list-hint">Spalten wie Karten · ${kundenLabel}</p>
      </div>
      <div class="stakeholder-scroll-x">
      <table class="stakeholder-table stakeholder-table--kunden">
        <thead>
          <tr>
            <th class="stakeholder-num">#</th>
            <th>Kunde</th>
            <th>Marke</th>
            <th>Typ</th>
            <th class="stakeholder-num">Auftragsvolumen</th>
            <th>Verbrauchtes Budget</th>
            <th class="stakeholder-num">${isInfluencerTab ? 'Offenes Creator Budget' : 'Verfügbares Budget'}</th>
            <th class="stakeholder-num">Creatoranteil</th>
            <th class="stakeholder-num">Agenturanteil</th>
            <th class="stakeholder-num">KSK</th>
            <th class="stakeholder-num">Zusatzkosten</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr class="stakeholder-row--total">
            <td class="stakeholder-num"></td>
            <td>GESAMT</td>
            <td></td>
            <td></td>
            <td class="stakeholder-num">${page.fmtEuro(totals.volumen)}</td>
            <td class="stakeholder-num">${page.fmtEuro(totals.verbraucht)}</td>
            <td class="stakeholder-num">${page.fmtEuro(isInfluencerTab ? influencerOffenesCreatorBudget(page) : totals.verfuegbar)}</td>
            <td class="stakeholder-num">${page.fmtEuro(totals.creator)}</td>
            <td>${renderAgenturZelle(page, totals.agentur, totals.agenturVoll)}</td>
            <td class="stakeholder-num">${page.fmtEuro(totals.ksk)}</td>
            <td class="stakeholder-num">${page.fmtEuro(totals.zusatz)}</td>
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  `;
}
