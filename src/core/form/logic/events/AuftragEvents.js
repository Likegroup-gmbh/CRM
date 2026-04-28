export async function setup(form, ctx) {
  const { formSystem } = ctx;

  const bruttobetragInput = form.querySelector('input[name="bruttobetrag"]');
  const deckungsbeitragProzentInput = form.querySelector('input[name="deckungsbeitrag_prozent"]');
  const deckungsbeitragBetragInput = form.querySelector('input[name="deckungsbeitrag_betrag"]');

  if (bruttobetragInput && deckungsbeitragProzentInput && deckungsbeitragBetragInput) {
    const calculateDeckungsbeitrag = () => {
      const bruttobetrag = parseFloat(bruttobetragInput.value) || 0;
      const prozent = parseFloat(deckungsbeitragProzentInput.value) || 0;
      const deckungsbeitrag = (bruttobetrag * prozent) / 100;
      deckungsbeitragBetragInput.value = deckungsbeitrag.toFixed(2);
    };

    bruttobetragInput.addEventListener('input', calculateDeckungsbeitrag);
    deckungsbeitragProzentInput.addEventListener('input', calculateDeckungsbeitrag);
  }

  const rechnungGestelltAm = form.querySelector('input[name="rechnung_gestellt_am"]');
  const zahlungszielTage = form.querySelector('select[name="zahlungsziel_tage"]');
  const reFaelligkeit = form.querySelector('input[name="re_faelligkeit"]');
  const erwarteterZahlungseingang = form.querySelector('input[name="erwarteter_monat_zahlungseingang"]');

  if (rechnungGestelltAm && zahlungszielTage && reFaelligkeit) {
    const calculateReFaelligkeit = () => {
      const datum = rechnungGestelltAm.value;
      const tage = parseInt(zahlungszielTage.value) || 0;
      if (datum && tage >= 0) {
        const date = new Date(datum);
        date.setDate(date.getDate() + tage);
        const berechnet = date.toISOString().split('T')[0];
        reFaelligkeit.value = berechnet;
        if (erwarteterZahlungseingang) erwarteterZahlungseingang.value = berechnet;
      } else if (!datum) {
        reFaelligkeit.value = '';
        if (erwarteterZahlungseingang) erwarteterZahlungseingang.value = '';
      }
    };
    rechnungGestelltAm.addEventListener('change', calculateReFaelligkeit);
    zahlungszielTage.addEventListener('change', calculateReFaelligkeit);
    calculateReFaelligkeit();
  }
}
