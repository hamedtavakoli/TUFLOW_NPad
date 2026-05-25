import { describe, expect, it } from 'vitest';
import { classifyInput, getAutocompleteSuggestions } from '../lib/autocomplete';

describe('getAutocompleteSuggestions', () => {
  it('suggests matching commands while typing', () => {
    const suggestions = getAutocompleteSuggestions('Read', []);

    expect(suggestions.map((suggestion) => suggestion.label)).toContain('Read GIS');
    expect(suggestions.map((suggestion) => suggestion.label)).toContain('Read GRID');
  });

  it('suggests registered files that match the command type', () => {
    const inputs = [
      classifyInput('2d_code.shp', 'gis\\2d_code.shp'),
      classifyInput('dem.asc', 'grids\\dem.asc')
    ];
    const suggestions = getAutocompleteSuggestions('Read GIS == ', inputs);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      label: '2d_code.shp',
      insertText: 'gis\\2d_code.shp'
    });
  });

  it('matches file suggestions after an opening quote', () => {
    const inputs = [classifyInput('2d_code.shp', 'gis\\2d_code.shp')];
    const suggestions = getAutocompleteSuggestions('Read GIS == "gis', inputs);

    expect(suggestions[0]?.insertText).toBe('gis\\2d_code.shp');
  });
});
