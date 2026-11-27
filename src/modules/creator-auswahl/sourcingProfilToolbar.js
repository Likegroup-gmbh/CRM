// sourcingProfilToolbar.js
// Was in der Hover-Toolbar der Link-Zellen (Instagram, TikTok) steht. Die Mechanik - Hover-
// Timing, Portal, Positionierung - liegt in src/core/hoverToolbar; hier stehen nur die zwei
// Aktionen und die beiden Hinweiszeilen.
//
// Als Factory, weil die Abruf-Aktion an die Detail-Instanz geht. Die gibt es erst beim Mount,
// also registriert CreatorAuswahlDetail.init() je Plattform eine Config und meldet sie im
// destroy() wieder ab.

import { socialHref } from '../../core/format/socialLink.js';
import { abrufZustand, formatStand, profilPlattform } from './sourcingProfilPlattformen.js';

export const PROFIL_ABRUF_AKTION = 'profil-abruf';

export function createSourcingProfilToolbarConfig(detail, plattform) {
  const p = profilPlattform(plattform);
  const zustand = (ctx) => abrufZustand({ ...ctx.item, [p.linkFeld]: ctx.url }, plattform);

  return {
    label: `${p.name}-Aktionen`,

    /**
     * Erst der Input, dann das Item: die Leiste soll auch fuer einen gerade eingetippten, noch
     * nicht gespeicherten Link oeffnen - der Abruf speichert ihn ohnehin vorher.
     */
    resolveContext(cell) {
      const id = cell.dataset.id;
      const item = detail.items?.find(i => i.id === id) || { id };
      const typed = cell.querySelector(`input[data-field="${p.linkFeld}"]`)?.value?.trim();

      return { id, item, url: typed || item[p.linkFeld] || '' };
    },

    // Ohne Link gibt es nichts abzurufen, die Leiste oeffnet gar nicht
    canOpen: (ctx) => !!ctx.url,

    actions: [
      /**
       * Die Hauptaktion wechselt mit dem Zustand. Der erste Klick fragt den Creator-Pool, ein
       * zweiter erzwingt den echten Abruf - deshalb heisst sie danach "Frisch abrufen".
       */
      {
        id: PROFIL_ABRUF_AKTION,
        variant: 'primary',
        icon: (ctx) => ({ fehler: 'warn', abgerufen: 'ig-refresh' }[zustand(ctx).zustand] || 'chart'),
        label: (ctx) => ({ fehler: 'Erneut versuchen', abgerufen: 'Frisch abrufen' }[zustand(ctx).zustand] || `${p.name}-Daten abrufen`),
        className: (ctx) => ({ fehler: 'is-error', abgerufen: 'is-refresh' }[zustand(ctx).zustand] || ''),
        title: (ctx) => {
          const z = zustand(ctx);
          if (z.zustand === 'fehler') return `Abruf fehlgeschlagen: ${z.fehler}`;
          if (z.zustand === 'abgerufen') return `Stand: ${formatStand(z.stand)} · frisch bei ${p.name} abrufen`;
          return 'Profil, Follower und Preise abrufen (bekannte Creator kommen aus dem Pool)';
        },
        onClick: (ctx, button) => detail[p.handler](ctx.id, button)
      },
      {
        id: 'open',
        type: 'link',
        variant: 'icon',
        icon: 'external',
        // Handle ohne Schema wuerde als relativer Link /castings/<handle> oeffnen
        href: (ctx) => socialHref(ctx.url, plattform),
        visible: (ctx) => !!socialHref(ctx.url, plattform),
        title: 'Profil in neuem Tab öffnen',
        ariaLabel: `${p.name}-Profil öffnen`
      }
    ],

    rows: [
      (ctx) => {
        const z = zustand(ctx);
        return z.zustand === 'fehler' && { kind: 'error', text: z.fehler };
      },
      // Nur der Zeitstempel eines erfolgten Abrufs ist eine Zusatzinfo wert
      (ctx) => {
        const z = zustand(ctx);
        return z.zustand === 'abgerufen' && { kind: 'hint', text: `Stand: ${formatStand(z.stand)}` };
      }
    ]
  };
}
