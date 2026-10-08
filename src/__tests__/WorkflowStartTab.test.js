import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKFLOW_TAB,
  resolveInitialWorkflowTab
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

  it('?tab=produktion bleibt als Deeplink erhalten', () => {
    window.isAdmin = () => true;
    window.history.replaceState(null, '', '/produktion/p1?tab=produktion');
    expect(resolveInitialWorkflowTab()).toBe('produktion');
  });

  it('altes ?tab=kooperation landet auf Produktion', () => {
    window.isAdmin = () => true;
    window.history.replaceState(null, '', '/produktion/p1?tab=kooperation');
    expect(resolveInitialWorkflowTab()).toBe('produktion');
  });
});
