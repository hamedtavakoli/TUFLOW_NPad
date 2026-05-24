import { describe, expect, it } from 'vitest';
import { formatTuflowText } from '../lib/formatter';

describe('formatTuflowText', () => {
  it('normalises assignment spacing without touching comments', () => {
    expect(formatTuflowText('Read GIS==gis\\2d_code.shp\n! keep me')).toBe('Read GIS == gis\\2d_code.shp\n! keep me');
  });
});
