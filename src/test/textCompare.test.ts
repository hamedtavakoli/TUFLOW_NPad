import { describe, expect, it } from 'vitest';
import { compareText } from '../lib/textCompare';

describe('compareText', () => {
  it('reports identical files', () => {
    const result = compareText('A\nB\nC', 'A\nB\nC');

    expect(result.isIdentical).toBe(true);
    expect(result.changeCount).toBe(0);
    expect(result.rows.map((row) => row.kind)).toEqual(['unchanged', 'unchanged', 'unchanged']);
  });

  it('detects added lines', () => {
    const result = compareText('A\nC', 'A\nB\nC');

    expect(result.isIdentical).toBe(false);
    expect(result.rows.map((row) => row.kind)).toEqual(['unchanged', 'added', 'unchanged']);
    expect(result.rows[1].right?.text).toBe('B');
  });

  it('detects deleted lines', () => {
    const result = compareText('A\nB\nC', 'A\nC');

    expect(result.rows.map((row) => row.kind)).toEqual(['unchanged', 'deleted', 'unchanged']);
    expect(result.rows[1].left?.text).toBe('B');
  });

  it('pairs changed lines as modified rows', () => {
    const result = compareText('A\nB old\nC', 'A\nB new\nC');

    expect(result.rows.map((row) => row.kind)).toEqual(['unchanged', 'modified', 'unchanged']);
    expect(result.rows[1].left?.text).toBe('B old');
    expect(result.rows[1].right?.text).toBe('B new');
  });

  it('handles empty left and right text', () => {
    expect(compareText('', '').rows).toEqual([]);
    expect(compareText('', 'A').rows[0]).toMatchObject({ kind: 'added', right: { lineNumber: 1, text: 'A' } });
    expect(compareText('A', '').rows[0]).toMatchObject({ kind: 'deleted', left: { lineNumber: 1, text: 'A' } });
  });

  it('can ignore blank lines', () => {
    const result = compareText('A\n\nB', 'A\nB', { ignoreBlankLines: true });

    expect(result.isIdentical).toBe(true);
    expect(result.rows.map((row) => row.left?.lineNumber)).toEqual([1, 3]);
  });

  it('can ignore extra spaces', () => {
    const result = compareText('Cell Size == 5', 'Cell   Size   ==   5', { ignoreExtraSpaces: true });

    expect(result.isIdentical).toBe(true);
  });

  it('can ignore case', () => {
    const result = compareText('Timestep == 1.0', 'TIMESTEP == 1.0', { ignoreCase: true });

    expect(result.isIdentical).toBe(true);
  });

  it('can ignore comment-only lines', () => {
    const result = compareText('A\n! tuflow comment\nB\nREM batch comment', 'A\nB', { ignoreComments: true });

    expect(result.isIdentical).toBe(true);
    expect(result.rows).toHaveLength(2);
  });

  it('can return only changed rows', () => {
    const result = compareText('A\nB old\nC', 'A\nB new\nC', { changedOnly: true });

    expect(result.rows.map((row) => row.kind)).toEqual(['modified']);
    expect(result.allRows.map((row) => row.kind)).toEqual(['unchanged', 'modified', 'unchanged']);
  });

  it('adds change indexes to changed rows', () => {
    const result = compareText('A\nB\nC', 'A\nD\nE');

    expect(result.rows.filter((row) => row.kind !== 'unchanged').map((row) => row.changeIndex)).toEqual([1, 2]);
  });

  it('marks exact changed words inside modified rows', () => {
    const result = compareText('Read GRID == old.asc', 'Read GRID == new.asc');
    const modified = result.rows.find((row) => row.kind === 'modified');

    expect(modified?.left?.segments?.filter((segment) => segment.changed).map((segment) => segment.text).join('')).toContain('old.asc');
    expect(modified?.right?.segments?.filter((segment) => segment.changed).map((segment) => segment.text).join('')).toContain('new.asc');
  });
});
