import { describe, expect, it } from 'vitest';
import { classifyInput, getAutocompleteSuggestions } from '../lib/autocomplete';

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
