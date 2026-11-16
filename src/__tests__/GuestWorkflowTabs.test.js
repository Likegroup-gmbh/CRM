import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getVisibleWorkflowTabs, resolveInitialWorkflowTab } from '../modules/kampagne/KampagneDetailWorkflow.js';

const GAST_SEITEN = new Set(['kampagne', 'kooperation', 'videos', 'sourcing', 'strategie', 'skripte']);
const tabIds = () => getVisibleWorkflowTabs().map(t => t.id);

describe('Workflow-Tabs der Produktion für Gäste', () => {
  beforeEach(() => {
    window.isAdmin = () => false;
    window.isGast = () => true;
    window.canSeePricing = () => false;
    window.canViewPage = (seite) => GAST_SEITEN.has(seite);
    window.history.replaceState(null, '', '/produktion/p1');
  });

  afterEach(() => {
    delete window.isGast;
    window.history.replaceState(null, '', '/');
  });

  it('öffnet mit Kooperationen statt dem ersten freien Tab', () => {
    expect(resolveInitialWorkflowTab()).toBe('kooperationen');
  });

  it('folgt weiter einem erlaubten ?tab=', () => {
    window.history.replaceState(null, '', '/produktion/p1?tab=skripte');
    expect(resolveInitialWorkflowTab()).toBe('skripte');
  });

  it('zeigt Gästen den Videos-Tab, obwohl sie kein Briefing-Recht haben', () => {
    expect(tabIds()).toEqual(['casting', 'konzepte', 'skripte', 'kooperationen', 'videos', 'auswertung']);
  });

  it('ohne Briefing-Recht bleibt Videos für alle anderen zu', () => {
    window.isGast = () => false;
    expect(tabIds()).not.toContain('videos');
  });
});
