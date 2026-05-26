import { describe, expect, it } from 'vitest';
import { classifyValuePattern } from '../lib/valuePattern';

describe('classifyValuePattern', () => {
  it('extracts options and defaults', () => {
    expect(classifyValuePattern('[ ON | {OFF} ]')).toMatchObject({
      expectsValue: true,
      kinds: expect.arrayContaining(['option']),
      options: ['ON', 'OFF'],
      defaultValue: 'OFF'
    });
  });

  it('classifies default-or-numeric-placeholder patterns as numbers, not option lists', () => {
    expect(classifyValuePattern('[ {1.0} | ⟨ timestep_in_seconds ⟩ ]')).toMatchObject({
      expectsValue: true,
      kinds: expect.arrayContaining(['number']),
      options: [],
      defaultValue: '1.0',
      extensions: [],
      placeholders: ['timestep_in_seconds']
    });
  });

  it('does not treat decimal defaults as file extensions', () => {
    expect(classifyValuePattern('[ {0.001} | ⟨ h_tol ⟩ ]')).toMatchObject({
      kinds: expect.arrayContaining(['number']),
      defaultValue: '0.001',
      extensions: []
    });
  });

  it('extracts file extensions from file placeholders', () => {
    expect(classifyValuePattern('[ ? .tgc_file ? ]')).toMatchObject({
      kinds: expect.arrayContaining(['file']),
      extensions: ['.tgc'],
      placeholders: ['.tgc_file']
    });
  });

  it('classifies GIS layer values with common GIS extensions', () => {
    const spec = classifyValuePattern('[ ? gis_layer ? ]');

    expect(spec.kinds).toEqual(expect.arrayContaining(['gis', 'file']));
    expect(spec.extensions).toEqual(expect.arrayContaining(['.shp', '.mif', '.gpkg']));
  });

  it('classifies numeric placeholders', () => {
    expect(classifyValuePattern('[ ? value ? ]')).toMatchObject({
      kinds: expect.arrayContaining(['number']),
      placeholders: ['value']
    });
  });

  it('classifies event and scenario placeholders as free text rather than literal dot options', () => {
    expect(classifyValuePattern('[ ? e1 ? | ? e2 ? | ? e3 ? | . ]')).toMatchObject({
      kinds: expect.arrayContaining(['string']),
      options: []
    });

    expect(classifyValuePattern('[ ? s1 ? | ? s2 ? | ? s3 ? | . ]')).toMatchObject({
      kinds: expect.arrayContaining(['string']),
      options: []
    });
  });

  it('classifies MI projection text as a file-or-string compound value', () => {
    expect(classifyValuePattern('[ ? .mif file ? | Projection_line_from_MIF_file ? ]')).toMatchObject({
      kinds: expect.arrayContaining(['file', 'string', 'compound']),
      extensions: ['.mif']
    });
  });

  it('treats default-plus-placeholder patterns as user-supplied values, not fixed options only', () => {
    expect(classifyValuePattern('[ {XMDF} | ? formats ? ]')).toMatchObject({
      kinds: expect.arrayContaining(['option', 'string', 'list', 'compound']),
      options: ['XMDF'],
      defaultValue: 'XMDF'
    });
  });

  it('returns no expected value metadata for no-value commands', () => {
    expect(classifyValuePattern(undefined, false)).toEqual({
      expectsValue: false,
      rawPattern: undefined,
      kinds: [],
      options: [],
      extensions: [],
      placeholders: [],
      allowsMultiple: false
    });
  });
});
