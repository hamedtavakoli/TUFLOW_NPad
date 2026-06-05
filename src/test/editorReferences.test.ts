import { describe, expect, it } from 'vitest';
import { referenceAtColumn } from '../lib/editorReferences';

describe('referenceAtColumn', () => {
  it('returns a plain file reference under the cursor', () => {
    const line = 'Read GIS == gis\\2d_code.shp';

    expect(referenceAtColumn(line, line.indexOf('2d_code'))).toBe('gis\\2d_code.shp');
  });

  it('returns a quoted file reference with spaces under the cursor', () => {
    const line = 'Read GIS == "gis\\model layers\\2d_code.shp" | optional';

    expect(referenceAtColumn(line, line.indexOf('model layers'))).toBe('gis\\model layers\\2d_code.shp');
  });

  it('does not return a reference when the cursor is outside the path', () => {
    const line = 'Read GIS == gis\\2d_code.shp';

    expect(referenceAtColumn(line, line.indexOf('Read'))).toBeUndefined();
  });

  it('does not return variable, wildcard, or folder references', () => {
    expect(referenceAtColumn('Read GRID == <<DEM_GRID>>', 15)).toBeUndefined();
    expect(referenceAtColumn('Read GIS == gis\\*.shp', 17)).toBeUndefined();
    expect(referenceAtColumn('Output Folder == results\\', 20)).toBeUndefined();
  });

  it('does not return numeric values', () => {
    const line = 'Timestep == 1.0';

    expect(referenceAtColumn(line, line.indexOf('1.0'))).toBeUndefined();
  });
});
