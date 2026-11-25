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

  it('Default ist Briefing', () => {
    expect(DEFAULT_WORKFLOW_TAB).toBe('briefing');
  });

  it('startet ohne ?tab= im Briefing', () => {
    window.isAdmin = () => true;
    window.history.replaceState(null, '', '/produktion/p1');
    expect(resolveInitialWorkflowTab()).toBe('briefing');
  });

  it('unbekannter ?tab= fällt auf Briefing zurück', () => {
    window.isAdmin = () => true;
    window.history.replaceState(null, '', '/produktion/p1?tab=gibtsnicht');
    expect(resolveInitialWorkflowTab()).toBe('briefing');
  });

  it('?tab=kooperationen bleibt als Deeplink erhalten', () => {
    window.isAdmin = () => true;
    window.history.replaceState(null, '', '/produktion/p1?tab=kooperationen');
    expect(resolveInitialWorkflowTab()).toBe('kooperationen');
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
