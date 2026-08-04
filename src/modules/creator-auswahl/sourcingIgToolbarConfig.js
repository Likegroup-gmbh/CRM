// sourcingIgToolbarConfig
// Was in der Hover-Toolbar der Instagram-Spalte steht. Die Mechanik - Hover-
// Timing, Portal, Positionierung - liegt in src/core/hoverToolbar; hier stehen
// nur die zwei Aktionen und die beiden Hinweiszeilen.
//
// Als Factory, weil die Abruf-Aktion an die Detail-Instanz geht. Die gibt es
// erst beim Mount, also registriert CreatorAuswahlDetail.init() diese Config und
// meldet sie im destroy() wieder ab.
//
// Vorher sass an dieser Stelle ein Haekchen-Button dauerhaft in der Zelle
// (renderIgFetchButton) und hat den Input zerdrueckt; der Fehlertext eines
// gescheiterten Abrufs stand nur in seinem title-Attribut.

/** Zeitstempel eines Abrufs in der Form, in der er auch im Punkt-Tooltip steht. */
function formatStand(wert) {
  return new Date(wert).toLocaleString('de-DE');
}

export function createSourcingIgToolbarConfig(detail) {
  return {
    label: 'Instagram-Aktionen',

    /**
     * Erst der Input, dann das Item: die Leiste soll auch fuer einen gerade
     * eingetippten, noch nicht gespeicherten Link oeffnen - handleInstagramFetch
     * speichert ihn ohnehin vor dem Abruf.
     */
    resolveContext(cell) {
      const id = cell.dataset.id;
      const item = detail.items?.find(i => i.id === id) || { id };
      const typed = cell.querySelector('input[data-field="link_instagram"]')?.value?.trim();

      return { id, item, url: typed || item.link_instagram || '' };
    },

    // Ohne Link gibt es nichts abzurufen. Damit entfaellt die frueh in
    // handleInstagramFetch sitzende Toast-Warnung "Bitte zuerst einen
    // Instagram-Link eintragen" - die Leiste oeffnet gar nicht.
    canOpen: (ctx) => !!ctx.url,

    actions: [
      /**
       * Die Hauptaktion wechselt mit dem Zustand. Der erste Klick fragt den
       * Creator-Pool, ein zweiter erzwingt den echten Meta-Abruf - deshalb heisst
       * sie im abgerufenen Zustand "Frisch abrufen" und nicht bloss "Erneut".
       */
      {
        id: 'ig-fetch',
        variant: 'primary',
        icon: ({ item }) => {
          if (item.ig_fetch_error) return 'warn';
          return item.ig_fetched_at ? 'ig-refresh' : 'chart';
        },
        label: ({ item }) => {
          if (item.ig_fetch_error) return 'Erneut versuchen';
          return item.ig_fetched_at ? 'Frisch abrufen' : 'Instagram-Daten abrufen';
        },
        className: ({ item }) => {
          if (item.ig_fetch_error) return 'is-error';
          return item.ig_fetched_at ? 'is-refresh' : '';
        },
        title: ({ item }) => {
          if (item.ig_fetch_error) return `Abruf fehlgeschlagen: ${item.ig_fetch_error}`;
          if (item.ig_fetched_at) {
            return `Stand: ${formatStand(item.ig_fetched_at)} · frisch bei Instagram abrufen`;
          }
          return 'Profil, Follower und CPM abrufen (bekannte Creator kommen aus dem Pool)';
        },
        onClick: (ctx, button) => detail.handleInstagramFetch(ctx.id, button)
      },
      {
        id: 'open',
        type: 'link',
        variant: 'icon',
        icon: 'external',
        href: (ctx) => ctx.url,
        visible: (ctx) => !!ctx.url,
        title: 'Profil in neuem Tab öffnen',
        ariaLabel: 'Instagram-Profil öffnen'
      }
    ],

    rows: [
      // Der Fehlertext steckte bisher nur im title-Attribut des Haekchens und
      // war damit praktisch unsichtbar.
      ({ item }) => item.ig_fetch_error && { kind: 'error', text: item.ig_fetch_error },

      // Nur der Zeitstempel eines erfolgten Abrufs ist eine Zusatzinfo wert. Ein
      // "noch nicht abgerufen" wuerde bloss die Button-Beschriftung wiederholen.
      ({ item }) => !item.ig_fetch_error && item.ig_fetched_at
        && { kind: 'hint', text: `Stand: ${formatStand(item.ig_fetched_at)}` }
    ]
  };
}
