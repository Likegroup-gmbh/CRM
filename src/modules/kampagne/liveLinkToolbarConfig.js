// liveLinkToolbarConfig
// Was in der Hover-Toolbar der Live-Link-Zelle steht. Die Mechanik - Hover-
// Timing, Portal, Positionierung - liegt in src/core/hoverToolbar; hier stehen
// nur die drei Aktionen und die beiden Hinweiszeilen.
//
// Als Factory und nicht als Konstante, weil die Aktionen an den StatsFetcher der
// Tabelle gehen. Den gibt es erst beim Mount, also registriert die Tabelle diese
// Config im Konstruktor und meldet sie im destroy() wieder ab.

import { findVideoInTable } from './liveLinkCell.js';

/** Zeitstempel eines Abrufs in der Form, in der er auch im Dot-Tooltip steht. */
function formatStand(wert) {
  return new Date(wert).toLocaleString('de-DE');
}

export function createLiveLinkToolbarConfig(table) {
  return {
    label: 'Live-Link-Aktionen',

    /**
     * Erst der Input, dann der Store: die Leiste soll auch fuer einen gerade
     * eingetippten, noch nicht gespeicherten Link oeffnen.
     */
    resolveContext(cell) {
      const id = cell.dataset.id;
      const video = findVideoInTable(table, id) || { id };
      const typed = cell.querySelector('input[data-field="link_live"]')?.value?.trim();

      return { id, video, url: typed || video.link_live || '' };
    },

    // Ohne Link gibt es nichts zu tun ausser tippen - dann bleibt die Zelle ruhig.
    canOpen: (ctx) => !!ctx.url,

    actions: [
      /**
       * Die Hauptaktion wechselt mit dem Zustand: noch kein Abruf, schon
       * abgerufen, oder letzter Abruf fehlgeschlagen.
       */
      {
        id: 'stats-fetch',
        variant: 'primary',
        icon: ({ video }) => {
          if (video.stats_error) return 'warn';
          return video.stats_fetched_at ? 'ig-refresh' : 'chart';
        },
        label: ({ video }) => {
          if (video.stats_error) return 'Erneut versuchen';
          return video.stats_fetched_at ? 'Aktualisieren' : 'Statistiken abrufen';
        },
        className: ({ video }) => {
          if (video.stats_error) return 'is-error';
          return video.stats_fetched_at ? 'is-refresh' : '';
        },
        title: ({ video }) => {
          if (video.stats_error) return `Abruf fehlgeschlagen: ${video.stats_error}`;
          if (video.stats_fetched_at) return `Stand: ${formatStand(video.stats_fetched_at)} · frisch abrufen`;
          return 'Views, Likes und Kommentare bei Instagram abrufen';
        },
        onClick: (ctx, button) => table._statsFetcher.handleFetch(ctx.id, button)
      },
      {
        id: 'open',
        type: 'link',
        variant: 'icon',
        icon: 'external',
        href: (ctx) => ctx.url,
        title: 'Video in neuem Tab öffnen',
        ariaLabel: 'Video öffnen'
      },
      { type: 'separator' },
      {
        id: 'link-clear',
        variant: 'icon',
        danger: true,
        icon: 'trash',
        title: 'Live-Link und Statistiken entfernen',
        ariaLabel: 'Live-Link entfernen',
        onClick: (ctx, button) => table._statsFetcher.handleClear(ctx.id, button)
      }
    ],

    rows: [
      // Der Fehlertext steckte bisher nur im title-Attribut des Haekchens und
      // war damit praktisch unsichtbar.
      ({ video }) => video.stats_error && { kind: 'error', text: video.stats_error },

      // Nur der Zeitstempel eines erfolgten Abrufs ist eine Zusatzinfo wert. Ein
      // "noch nicht abgerufen" wuerde bloss die Button-Beschriftung wiederholen.
      ({ video }) => !video.stats_error && video.stats_fetched_at
        && { kind: 'hint', text: `Stand: ${formatStand(video.stats_fetched_at)}` }
    ]
  };
}
