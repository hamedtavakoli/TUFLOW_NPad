import { describe, expect, it } from 'vitest';
import { getEditorLanguage, isTuflowEditorLanguage, tuflowEditorExtensions } from '../lib/editorLanguage';

describe('editor language selection', () => {
  it('uses TUFLOW language features for control-like files', () => {
    for (const extension of tuflowEditorExtensions) {
      expect(getEditorLanguage(`model\\run${extension}`)).toBe('tuflow');
    }
  });

  it('uses batch highlighting for Windows command scripts', () => {
    expect(getEditorLanguage('scripts\\run.bat')).toBe('batch');
    expect(getEditorLanguage('scripts\\run.cmd')).toBe('batch');
  });

  it('uses plain text for non-TUFLOW support files', () => {
    expect(getEditorLanguage('runs\\run.log')).toBe('plain');
    expect(getEditorLanguage('tables\\bc_dbase.csv')).toBe('plain');
  });

  it('identifies TUFLOW language mode explicitly', () => {
    expect(isTuflowEditorLanguage('tuflow')).toBe(true);
    expect(isTuflowEditorLanguage('batch')).toBe(false);
    expect(isTuflowEditorLanguage('plain')).toBe(false);
  });
});
