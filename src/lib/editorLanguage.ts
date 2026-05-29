import { getExtension } from './parser';

export type EditorLanguage = 'tuflow' | 'batch' | 'plain';

export const tuflowEditorExtensions = [
  '.adcf',
  '.ecf',
  '.erd',
  '.qcf',
  '.rdf',
  '.tbc',
  '.tcf',
  '.tef',
  '.tesf',
  '.tgc',
  '.tmf',
  '.toc',
  '.tpc',
  '.trd',
  '.trfc',
  '.tscf',
  '.tsoilf'
];

const batchEditorExtensions = ['.bat', '.cmd'];

export function getEditorLanguage(path: string): EditorLanguage {
  const extension = getExtension(path);
  if (tuflowEditorExtensions.includes(extension)) return 'tuflow';
  if (batchEditorExtensions.includes(extension)) return 'batch';
  return 'plain';
}

export function isTuflowEditorLanguage(language: EditorLanguage): boolean {
  return language === 'tuflow';
}
