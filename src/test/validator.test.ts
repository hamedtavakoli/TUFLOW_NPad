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

  it('uses command metadata to warn about duplicate-sensitive commands', () => {
    const problems = validateTuflowText('Cell Size == 5\nCell Size == 10', []);

    expect(problems.some((problem) => problem.id.startsWith('duplicate-Cell Size'))).toBe(true);
  });

  it('normalises command spacing and case before configured command matching', () => {
    const problems = validateTuflowText('read    gis == gis\\2d_code.shp', [classifyInput('2d_code.shp', 'gis\\2d_code.shp')]);

    expect(problems.some((problem) => problem.id.startsWith('unknown'))).toBe(false);
    expect(problems.some((problem) => problem.id.startsWith('command-token'))).toBe(false);
  });

  it('soft-warns for known keyword phrases that are not configured yet', () => {
    const problems = validateTuflowText('Read GIS Z Shape == gis\\zshape.shp', [classifyInput('zshape.shp', 'gis\\zshape.shp')]);

    expect(problems).toContainEqual(expect.objectContaining({
      id: 'unknown-phrase-1',
      severity: 'warning'
    }));
  });

  it('soft-warns for unknown command tokens without breaking parsing', () => {
    const problems = validateTuflowText('Reed GIS == gis\\2d_code.shp', [classifyInput('2d_code.shp', 'gis\\2d_code.shp')]);

    expect(problems).toContainEqual(expect.objectContaining({
      id: 'command-token-1',
      severity: 'warning',
      message: 'Possible typo in command word(s): Reed.'
    }));
  });
});
