import { describe, expect, it } from 'vitest';
import { classifyInput, commandSuggestionDetail, commandSyntaxSuffix, getAutocompleteSuggestions } from '../lib/autocomplete';
import { completionStart } from '../lib/completionRange';
import { buildTuflowSymbolIndex } from '../lib/tuflowSymbols';
import type { Suggestion } from '../lib/types';

describe('getAutocompleteSuggestions', () => {
  it('suggests matching commands while typing', () => {
    const suggestions = getAutocompleteSuggestions('Read', []);

    expect(suggestions.map((suggestion) => suggestion.label)).toContain('Read GIS IWL');
  });

  it('splits command syntax and summaries for cleaner suggestion rows', () => {
    const suggestion = getAutocompleteSuggestions('BC Control File', [])[0];

    expect(suggestion.detail).toContain(' == [ <.tbc> ] - ');
    expect(suggestion.detail).not.toContain('BC Control File ==');
    expect(suggestion.syntaxSuffix).toBe(' == [ <.tbc> ]');
    expect(suggestion.summary).toContain('Specifies the file containing boundary conditions');
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
    const suggestions = getAutocompleteSuggestions('Quadtree Control File == S', []);

    expect(suggestions).toContainEqual(expect.objectContaining({
      label: 'Single Level',
      insertText: 'Single Level',
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

  it('suggests active-file variables after a variable reference opener', () => {
    const symbols = buildTuflowSymbolIndex('Set Variable START_TIME == 1');
    const suggestions = getAutocompleteSuggestions('Start Time == <<', [], symbols);

    expect(suggestions).toContainEqual(expect.objectContaining({
      label: '<<START_TIME>>',
      insertText: '<<START_TIME>>',
      kind: 'snippet'
    }));
  });

  it('suggests active-file scenarios and events in logic conditions', () => {
    const symbols = buildTuflowSymbolIndex('Model Scenarios == 5m | 10m\nModel Events == 01AEP | 02AEP');

    expect(getAutocompleteSuggestions('If Scenario == 1', [], symbols)).toContainEqual(expect.objectContaining({
      label: '10m',
      insertText: '10m',
      kind: 'keyword'
    }));
    expect(getAutocompleteSuggestions('If Event == 02', [], symbols)).toContainEqual(expect.objectContaining({
      label: '02AEP',
      insertText: '02AEP',
      kind: 'keyword'
    }));
  });

  it('does not suggest reference delimiters while defining a variable name', () => {
    const symbols = buildTuflowSymbolIndex('Set Variable START_TIME == 1');
    const suggestions = getAutocompleteSuggestions('Set Variable << == ', [], symbols);

    expect(suggestions.some((suggestion) => suggestion.insertText.includes('<<START_TIME>>'))).toBe(false);
  });

  it('suggests event and scenario filename placeholders in value context', () => {
    const suggestions = getAutocompleteSuggestions('Output Folder == ~s', [], buildTuflowSymbolIndex(''));

    expect(suggestions).toContainEqual(expect.objectContaining({
      label: '~s1~',
      insertText: '~s1~',
      kind: 'snippet'
    }));
  });

});

describe('commandSuggestionDetail', () => {
  it('uses syntax only when no summary is available', () => {
    expect(commandSuggestionDetail('Read GIS', 'Read GIS == [ <gis_layer> ]', undefined)).toBe(' == [ <gis_layer> ]');
  });

  it('shortens long command summaries', () => {
    const detail = commandSuggestionDetail('Read GIS', 'Read GIS == [ <gis_layer> ]', 'A'.repeat(140));

    expect(detail).toHaveLength(' == [ <gis_layer> ] - '.length + 90);
    expect(detail.endsWith('...')).toBe(true);
  });
});

describe('commandSyntaxSuffix', () => {
  it('removes the repeated command name from syntax', () => {
    expect(commandSyntaxSuffix('Model Events', 'Model Events == [ <e1> | <e2> ]')).toBe(' == [ <e1> | <e2> ]');
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
