import { describe, expect, it } from 'vitest';
import { detectFileRefs, parseTuflowDocument, parseTuflowLine } from './tuflowParser';

describe('parseTuflowLine', () => {
  it('parses a command assignment with a file reference', () => {
    const line = parseTuflowLine('Read GIS Z Shape == input/topography/zshape.shp', 7);

    expect(line).toMatchObject({
      lineNumber: 7,
      raw: 'Read GIS Z Shape == input/topography/zshape.shp',
      type: 'command',
      command: 'Read GIS Z Shape',
      operator: '==',
      value: 'input/topography/zshape.shp',
      fileRefs: ['input/topography/zshape.shp']
    });
  });

  it('keeps inline comments separate from the parsed value', () => {
    const line = parseTuflowLine('Cell Size == 5 ! metres', 3);

    expect(line.value).toBe('5');
    expect(line.inlineComment).toBe('! metres');
  });

  it('does not treat comment markers inside quoted paths as comments', () => {
    const line = parseTuflowLine('Read GIS == "input/not!comment/2d_code.shp" ! layer', 1);

    expect(line.value).toBe('"input/not!comment/2d_code.shp"');
    expect(line.fileRefs).toEqual(['input/not!comment/2d_code.shp']);
    expect(line.inlineComment).toBe('! layer');
  });

  it('marks command-like lines without == as invalid but tolerant', () => {
    const line = parseTuflowLine('Read GIS input/topography/zshape.shp', 1);

    expect(line.type).toBe('invalid');
    expect(line.warnings).toContain('Missing == operator.');
  });

  it('parses whole documents line by line', () => {
    const lines = parseTuflowDocument('! comment\n\nOutput Folder == results\\<<~s1~>>\\');

    expect(lines.map((line) => line.type)).toEqual(['comment', 'blank', 'command']);
  });
});

describe('detectFileRefs', () => {
  it('detects multiple file references in a value', () => {
    expect(detectFileRefs('a\\b.tgc | "gis/model layer.shp"')).toEqual(['a\\b.tgc', 'gis/model layer.shp']);
  });
});
