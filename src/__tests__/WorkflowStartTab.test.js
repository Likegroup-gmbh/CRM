import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKFLOW_TAB,
  resolveInitialWorkflowTab,
  rewriteWorkflowTabAlias
} from '../modules/kampagne/KampagneDetailWorkflow.js';

describe('Start-Tab der Produktion-Detailseite', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('Default ist Kooperationen', () => {
    expect(DEFAULT_WORKFLOW_TAB).toBe('kooperationen');
  });

  it('startet ohne ?tab= in Kooperationen', () => {
    window.isAdmin = () => true;
    window.history.replaceState(null, '', '/produktion/p1');
    expect(resolveInitialWorkflowTab()).toBe('kooperationen');
  });

  it('unbekannter ?tab= fällt auf Kooperationen zurück', () => {
    window.isAdmin = () => true;
    window.history.replaceState(null, '', '/produktion/p1?tab=gibtsnicht');
    expect(resolveInitialWorkflowTab()).toBe('kooperationen');
  });

  it('?tab=briefing bleibt als Deeplink erhalten', () => {
    window.isAdmin = () => true;
    window.history.replaceState(null, '', '/produktion/p1?tab=briefing');
    expect(resolveInitialWorkflowTab()).toBe('briefing');
  });

  it('altes ?tab=produktion landet auf Kooperationen und wird umgeschrieben', () => {
    window.isAdmin = () => true;
    window.history.replaceState(null, '', '/produktion/p1?tab=produktion');
    const tab = resolveInitialWorkflowTab();
    rewriteWorkflowTabAlias(tab);
    expect(tab).toBe('kooperationen');
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('kooperationen');
  });

  it('altes ?tab=kooperation landet auf Kooperationen und wird umgeschrieben', () => {
    window.isAdmin = () => true;
    window.history.replaceState(null, '', '/produktion/p1?tab=kooperation');
    const tab = resolveInitialWorkflowTab();
    rewriteWorkflowTabAlias(tab);
    expect(tab).toBe('kooperationen');
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('kooperationen');
  });

  it('schreibt einen Alias nicht um, wenn der Tab nicht offen ist', () => {
    window.isAdmin = () => true;
    window.history.replaceState(null, '', '/produktion/p1?tab=produktion');
    rewriteWorkflowTabAlias('briefing');
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('produktion');
  });
});
