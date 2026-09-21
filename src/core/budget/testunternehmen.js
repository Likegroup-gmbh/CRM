// testunternehmen.js
// Eine Quelle fuer den Ausschluss aus Investor-Zahlen / Cashflow.
// RLS blendet den Graphen fuer Nicht-Admins; Admins sehen ihn operativ,
// Aggregationen droppen ihn trotzdem.

export function isTestUnternehmen(unternehmen) {
  return unternehmen?.ist_test === true;
}

export function testunternehmenBadgeHtml() {
  return '<span class="status-badge status-warning">Test</span>';
}

export function testUnternehmenIdSet(unternehmenRows) {
  return new Set(
    (unternehmenRows || []).filter((u) => u?.ist_test === true).map((u) => u.id).filter(Boolean),
  );
}

export function dropTestunternehmenBestand(bestand) {
  const testIds = testUnternehmenIdSet(bestand.unternehmen);
  const rawAuftraege = bestand.auftraege || [];
  if (testIds.size === 0) {
    return {
      ...bestand,
      auftraege: rawAuftraege.filter((a) => a.is_draft !== true),
    };
  }

  const testAuftragIds = new Set(
    rawAuftraege.filter((a) => testIds.has(a.unternehmen_id)).map((a) => a.id),
  );
  const auftraege = rawAuftraege.filter(
    (a) => a.is_draft !== true && !testIds.has(a.unternehmen_id),
  );
  const auftragIds = new Set(auftraege.map((a) => a.id));
  const kampagnen = (bestand.kampagnen || []).filter((k) => auftragIds.has(k.auftrag_id));
  const kampagneIds = new Set(kampagnen.map((k) => k.id));
  const kooperationen = (bestand.kooperationen || []).filter((k) => kampagneIds.has(k.kampagne_id));
  const koopIds = new Set(kooperationen.map((k) => k.id));
  const testKampagneIds = new Set(
    (bestand.kampagnen || []).filter((k) => testAuftragIds.has(k.auftrag_id)).map((k) => k.id),
  );
  const testKoopIds = new Set(
    (bestand.kooperationen || [])
      .filter((k) => testKampagneIds.has(k.kampagne_id))
      .map((k) => k.id),
  );

  const isTestRechnung = (r) =>
    (r.auftrag_id && testAuftragIds.has(r.auftrag_id))
    || (r.kampagne_id && testKampagneIds.has(r.kampagne_id))
    || (r.kooperation_id && testKoopIds.has(r.kooperation_id));

  return {
    ...bestand,
    auftraege,
    blocks: (bestand.blocks || []).filter((b) => auftragIds.has(b.auftrag_id)),
    kampagnen,
    kooperationen,
    videos: (bestand.videos || []).filter((v) => koopIds.has(v.kooperation_id)),
    rechnungen: (bestand.rechnungen || []).filter((r) => !isTestRechnung(r)),
    details: (bestand.details || []).filter((d) => auftragIds.has(d.auftrag_id)),
    unternehmen: (bestand.unternehmen || []).filter((u) => !u.ist_test),
    teilrechnungen: (bestand.teilrechnungen || []).filter((t) => auftragIds.has(t.auftrag_id)),
  };
}
