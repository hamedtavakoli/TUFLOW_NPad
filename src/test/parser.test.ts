import { describe, expect, it } from 'vitest';
import { parseLine, parseTuflowText } from '../lib/parser';

describe('parseTuflowText', () => {
  it('identifies comments, commands, assignment operators, and references', () => {
    const lines = parseTuflowText('! comment\nRead GIS == gis\\2d_code.shp');

    expect(lines[0].isComment).toBe(true);
    expect(lines[1]).toMatchObject({
      lineNumber: 2,
      commandText: 'Read GIS',
      parameterText: 'gis\\2d_code.shp',
      hasAssignment: true,
      reference: 'gis\\2d_code.shp'
    });
  });

  it('detects event and scenario placeholders', () => {
    const line = parseLine('Output Folder == results\\<<~s1~>>\\', 1);

    expect(line.placeholders).toEqual(['<<~s1~>>']);
  });
});
