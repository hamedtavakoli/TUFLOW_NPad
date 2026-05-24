import { describe, expect, it } from 'vitest';
import { classifyInput } from '../lib/autocomplete';
import { validateTuflowText } from '../lib/validator';

describe('validateTuflowText', () => {
  it('warns when a referenced file is not registered', () => {
    const problems = validateTuflowText('Read GIS == gis\\missing.shp', []);

    expect(problems.some((problem) => problem.id.startsWith('missing-input'))).toBe(true);
  });

  it('reports missing assignment for a known command', () => {
    const problems = validateTuflowText('Read GIS gis\\2d_code.shp', [classifyInput('2d_code.shp', 'gis\\2d_code.shp')]);

    expect(problems[0]).toMatchObject({
      severity: 'error',
      message: '"Read GIS" is missing the == assignment operator.'
    });
  });

  it('warns when a file extension is inconsistent with the command', () => {
    const problems = validateTuflowText('Read GRID == gis\\roughness.shp', [classifyInput('roughness.shp', 'gis\\roughness.shp')]);

    expect(problems.some((problem) => problem.id.startsWith('extension'))).toBe(true);
  });
});
