// Pure Helper: Zeilen für den Block „Auftragnehmer / Influencer“ im Contracting-PDF.
// Toggle nur_management_adresse steuert Label (Agentur vs. Name) und Layout.
// Bei Vertretung + Toggle AUS: Creator-Name + Agentur-Adresse (nicht Creator-Adresse).

function formatAddressLines(streetParts, plz, stadt, land, landFallback) {
  const strasse = `${streetParts.strasse || ''} ${streetParts.hausnummer || ''}`.trim() || '-';
  const plzStadt = `${plz || ''} ${stadt || ''}`.trim() || '-';
  return [strasse, plzStadt, land || landFallback || 'Deutschland'];
}

function partyAddressLines(address, creator, landFallback) {
  if (address && (address.strasse || address.plz || address.stadt)) {
    const lines = [];
    if (address.source === 'firma' && address.name) {
      lines.push(`Firma: ${address.name}`);
    }
    lines.push(...formatAddressLines(
      { strasse: address.strasse, hausnummer: address.hausnummer },
      address.plz,
      address.stadt,
      address.land,
      landFallback
    ));
    return lines;
  }
  return formatAddressLines(
    {
      strasse: creator?.lieferadresse_strasse,
      hausnummer: creator?.lieferadresse_hausnummer
    },
    creator?.lieferadresse_plz,
    creator?.lieferadresse_stadt,
    creator?.lieferadresse_land,
    landFallback
  );
}

/**
 * @param {{ vertrag: object, creator: object|null|undefined, address: object|null|undefined }} params
 * @returns {string[]} Textzeilen (ohne Überschrift), zentriert zu rendern
 */
export function buildContractingAuftragnehmerLines({ vertrag, creator, address }) {
  const creatorName = `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim() || '-';
  const landFallback = vertrag?.influencer_land || 'Deutschland';
  const creatorAddressLines = partyAddressLines(address, creator, landFallback);
  const vertreten = !!vertrag?.influencer_agentur_vertreten;
  const hasAgencyData = !!(
    vertrag?.influencer_agentur_name ||
    vertrag?.influencer_agentur_strasse ||
    vertrag?.influencer_agentur_hausnummer ||
    vertrag?.influencer_agentur_plz ||
    vertrag?.influencer_agentur_stadt ||
    vertrag?.influencer_agentur_land ||
    address?.source === 'management'
  );
  const showAgency = vertreten || hasAgencyData;
  const forceManagement = !!(vertrag?.nur_management_adresse && showAgency);

  if (forceManagement) {
    const lines = [
      `Agentur: ${vertrag.influencer_agentur_name || '-'}`,
      ...formatAddressLines(
        {
          strasse: address?.strasse || vertrag.influencer_agentur_strasse,
          hausnummer: address?.hausnummer || vertrag.influencer_agentur_hausnummer
        },
        address?.plz || vertrag.influencer_agentur_plz,
        address?.stadt || vertrag.influencer_agentur_stadt,
        address?.land || vertrag.influencer_agentur_land,
        landFallback
      )
    ];
    const vertretung = (vertrag.influencer_agentur_vertretung || '').trim();
    if (vertretung) {
      lines.push(`Vertreten durch: ${vertretung}`);
    }
    lines.push(`Influencer: ${creatorName}`);
    return lines;
  }

  // Toggle AUS + Agentur: Influencer-Name + Influencer-Adresse + Agenturname + Agentur-Adresse
  if (showAgency) {
    return [
      `Name: ${creatorName}`,
      ...creatorAddressLines,
      '',
      `Vertreten durch Agentur: ${vertrag.influencer_agentur_name || '-'}`,
      ...formatAddressLines(
        {
          strasse: vertrag.influencer_agentur_strasse || address?.strasse,
          hausnummer: vertrag.influencer_agentur_hausnummer || address?.hausnummer
        },
        vertrag.influencer_agentur_plz || address?.plz,
        vertrag.influencer_agentur_stadt || address?.stadt,
        vertrag.influencer_agentur_land || address?.land,
        landFallback
      )
    ];
  }

  // Ohne Agentur: Creator-Name + Creator-/Resolver-Adresse
  return [
    `Name: ${creatorName}`,
    ...creatorAddressLines
  ];
}
