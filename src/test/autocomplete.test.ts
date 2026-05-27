import { describe, expect, it } from 'vitest';
import { classifyInput, getAutocompleteSuggestions } from '../lib/autocomplete';
import { completionStart } from '../lib/completionRange';
import type { Suggestion } from '../lib/types';

describe('getAutocompleteSuggestions', () => {
  it('suggests matching commands while typing', () => {
    const suggestions = getAutocompleteSuggestions('Read', []);

    expect(suggestions.map((suggestion) => suggestion.label)).toContain('Read GIS IWL');
  });

  it('suggests registered files that match the command type', () => {
    const inputs = [
      classifyInput('model.tbc', 'model\\model.tbc'),
      classifyInput('2d_code.shp', 'gis\\2d_code.shp')
    ];
    const suggestions = getAutocompleteSuggestions('BC Control File == ', inputs);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      label: 'model.tbc',
      insertText: 'model\\model.tbc'
    });
  });

  it('matches file suggestions after an opening quote', () => {
    const inputs = [classifyInput('model.tbc', 'model\\model.tbc')];
    const suggestions = getAutocompleteSuggestions('BC Control File == "model', inputs);

    expect(suggestions[0]?.insertText).toBe('model\\model.tbc');
  });

  it('suggests configured options from the command value pattern', () => {
    const suggestions = getAutocompleteSuggestions('MI Projection Check Ignore Bounds == ', []);

    expect(suggestions.map((suggestion) => suggestion.label)).toEqual(['OFF', 'ON']);
    expect(suggestions.every((suggestion) => suggestion.kind === 'keyword')).toBe(true);
  });

  it('filters configured option suggestions by typed value', () => {
    const suggestions = getAutocompleteSuggestions('ESTRY Control File == A', []);

    expect(suggestions).toContainEqual(expect.objectContaining({
      label: 'AUTO',
      insertText: 'AUTO',
      kind: 'keyword'
    }));
  });

  it('suggests ON/OFF values for Write CFL immediately after assignment', () => {
    const suggestions = getAutocompleteSuggestions('Write CFL == ', [
      classifyInput('materials.tmf', 'materials\\materials.tmf')
    ]);

    expect(suggestions).toEqual([
      expect.objectContaining({ label: 'ON', kind: 'keyword' }),
      expect.objectContaining({ label: 'OFF', kind: 'keyword' })
    ]);
  });

});

describe('completionStart', () => {
  const commandSuggestions: Suggestion[] = [
    {
      label: 'Read GIS',
      detail: 'Read GIS == <gis layer>',
      insertText: 'Read GIS == ',
      kind: 'command'
    }
  ];

  const valueSuggestions: Suggestion[] = [
    {
      label: 'ON',
      detail: 'Option - Write CFL',
      insertText: 'ON',
      kind: 'keyword'
    }
  ];

  it('replaces the whole command prefix after a completed first word', () => {
    expect(completionStart('read ', 5, commandSuggestions)).toBe(0);
  });

  it('replaces the whole command prefix while typing the next command word', () => {
    expect(completionStart('read g', 6, commandSuggestions)).toBe(0);
  });

  it('preserves indentation when replacing a command prefix', () => {
    expect(completionStart('  read g', 8, commandSuggestions)).toBe(2);
  });

  it('keeps value completions scoped to the value after assignment', () => {
    expect(completionStart('Write CFL == O', 14, valueSuggestions)).toBe(13);
  });
});
