import { describe, expect, it } from 'vitest';
import { isTuflowKeyword, parseNotepadPlusKeywordXml, tuflowLanguageRules } from './tuflowKeywords';

describe('tuflow language keywords', () => {
  it('parses Notepad++ keyword groups into operators and keywords', () => {
    const groups = parseNotepadPlusKeywordXml('<Keywords name="Keywords1">==</Keywords><Keywords name="Keywords2">Read GIS GRID</Keywords>');

    expect(groups.operators).toEqual(['==']);
    expect(groups.keywords).toEqual(['GIS', 'GRID', 'Read']);
  });

  it('matches extracted TUFLOW keywords case-insensitively', () => {
    expect(tuflowLanguageRules.operators).toContain('==');
    expect(isTuflowKeyword('read')).toBe(true);
    expect(isTuflowKeyword('GIS')).toBe(true);
  });
});
