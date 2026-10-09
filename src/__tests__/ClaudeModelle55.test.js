import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { calculateCost } = require('../../netlify/functions/_shared/claude-cost.js');
const { shapeRequest, MODELS } = require('../../netlify/functions/_shared/anthropic.js');

const TOOL = { name: 'liefere', description: 'x', input_schema: { type: 'object' } };

describe('Modell-Defaults', () => {
  it('Haiku und Sonnet laufen auf 5.5, Schreiben auf Opus 4.6', () => {
    expect(MODELS.write).toBe('claude-opus-4-6');
    expect(MODELS.edit_write).toBe('claude-opus-4-6');
    for (const key of ['distill', 'edit_fast', 'extract', 'resolve']) {
      expect(MODELS[key]).toBe('claude-haiku-5-5');
    }
    for (const key of ['extract_produkt', 'extract_briefing', 'extract_rechnung', 'persona', 'casting', 'konzept']) {
      expect(MODELS[key]).toBe('claude-sonnet-5-5');
    }
  });
});

describe('calculateCost 5.5', () => {
  it('Sonnet 5.5 rechnet 2 / 10 mit Cache-Read 0,10 (nicht das Sonnet-5-Prefix)', () => {
    const cost = calculateCost('claude-sonnet-5-5', {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000
    });
    expect(cost.model).toBe('claude-sonnet-5-5');
    expect(cost.usd).toBeCloseTo(2 + 10 + 0.1, 6);
  });

  it('Haiku 5.5 bis 100k Prompt-Tokens: 0,10 / 0,50', () => {
    const cost = calculateCost('claude-haiku-5-5', { input_tokens: 100_000, output_tokens: 1_000_000 });
    expect(cost.usd).toBeCloseTo(0.1 * 0.1 + 0.5, 6);
  });

  it('Haiku 5.5 ueber 100k Prompt-Tokens: ganze Anfrage zu 0,50 / 2,50', () => {
    const cost = calculateCost('claude-haiku-5-5', {
      input_tokens: 50_000,
      cache_read_input_tokens: 50_001,
      output_tokens: 1_000_000
    });
    // 50.000 x 0,50 + 50.001 x 0,05 (Cache-Read) + 1 Mio x 2,50, pro Mio Tokens
    expect(cost.usd).toBeCloseTo(0.025 + 0.00250005 + 2.5, 6);
  });

  it('Cache-Write zaehlt zur Prompt-Laenge der Haiku-Schwelle', () => {
    const cost = calculateCost('claude-haiku-5-5', {
      input_tokens: 1000,
      cache_creation_input_tokens: 100_000,
      output_tokens: 0
    });
    expect(cost.usd).toBeCloseTo((1000 * 0.5 + 100_000 * 0.625) / 1_000_000, 6);
  });

  it('4.5-Preise bleiben fuer alte Logs', () => {
    expect(calculateCost('claude-sonnet-4-5-20250929', { input_tokens: 1_000_000, output_tokens: 0 }).usd).toBeCloseTo(3, 6);
    expect(calculateCost('claude-haiku-4-5-20251001', { input_tokens: 1_000_000, output_tokens: 0 }).usd).toBeCloseTo(1, 6);
  });
});

describe('shapeRequest', () => {
  it('Sonnet 5.5: between_tools, tool_choice auto, Hinweis im Prompt', () => {
    const r = shapeRequest({ model: 'claude-sonnet-5-5', tool: TOOL, toolForced: true });
    expect(r.thinking).toEqual({ type: 'between_tools' });
    expect(r.toolParams.tool_choice).toEqual({ type: 'auto' });
    expect(r.systemHint).toContain('liefere');
    expect(r.maxTokens).toBe(4096);
  });

  it('Sonnet 5.5 ohne Tool: between_tools, kein Hinweis', () => {
    const r = shapeRequest({ model: 'claude-sonnet-5-5' });
    expect(r.thinking).toEqual({ type: 'between_tools' });
    expect(r.toolParams).toEqual({});
    expect(r.systemHint).toBeNull();
  });

  it('Haiku 5.5: disabled, erzwungenes Tool bleibt', () => {
    const r = shapeRequest({ model: 'claude-haiku-5-5', tool: TOOL, toolForced: true });
    expect(r.thinking).toEqual({ type: 'disabled' });
    expect(r.toolParams.tool_choice).toEqual({ type: 'tool', name: 'liefere' });
    expect(r.systemHint).toBeNull();
  });

  it('Haiku 5.5 mit Websuche (toolForced false): auto', () => {
    const r = shapeRequest({ model: 'claude-haiku-5-5', tool: { type: 'web_search_20250305', name: 'web_search' }, toolForced: false });
    expect(r.toolParams.tool_choice).toEqual({ type: 'auto' });
  });

  it('5.5 mit thinking:true: adaptiv ohne budget_tokens, max_tokens unveraendert', () => {
    for (const model of ['claude-sonnet-5-5', 'claude-haiku-5-5']) {
      const r = shapeRequest({ model, thinking: true, thinkingBudget: 2048, maxTokens: 1000 });
      expect(r.thinking).toEqual({ type: 'adaptive' });
      expect(r.maxTokens).toBe(1000);
    }
  });

  it('Opus 4.6 mit thinking:true: budget_tokens, max_tokens ueber dem Budget, Tool auto', () => {
    const r = shapeRequest({ model: 'claude-opus-4-6', thinking: true, thinkingBudget: 2048, maxTokens: 1000, tool: TOOL, toolForced: true });
    expect(r.thinking).toEqual({ type: 'enabled', budget_tokens: 2048 });
    expect(r.maxTokens).toBe(4096);
    expect(r.toolParams.tool_choice).toEqual({ type: 'auto' });
    expect(r.systemHint).toBeNull();
  });

  it('Opus 4.6 ohne Thinking: kein thinking-Feld, Tool erzwungen', () => {
    const r = shapeRequest({ model: 'claude-opus-4-6', tool: TOOL, toolForced: true });
    expect(r.thinking).toBeNull();
    expect(r.toolParams.tool_choice).toEqual({ type: 'tool', name: 'liefere' });
  });
});
