import { describe, expect, it } from 'vitest';
import {
  checkProjectFileAvailability,
  createProjectFileIndex,
  defaultExcludedFolderNames,
  findProjectFileByReference,
  isReadableProjectFile,
  isUncheckableReference,
  isPathInsideExcludedFolder,
  normaliseProjectPath,
  readableProjectFileAccept,
  readableProjectFileExtensions
} from '../lib/projectFiles';

describe('project file index', () => {
  it('normalises slash styles and relative prefixes', () => {
    expect(normaliseProjectPath('./gis//2d_code.shp')).toBe('gis\\2d_code.shp');
  });

  it('matches referenced paths case-insensitively', () => {
    const index = createProjectFileIndex('Model', ['GIS\\2D_CODE.SHP']);

    expect(checkProjectFileAvailability('gis/2d_code.shp', index)).toEqual({ status: 'available' });
  });

  it('can match a referenced filename when only a tab or bare file is indexed', () => {
    const index = createProjectFileIndex('Model', ['M01_001.tgc']);

    expect(checkProjectFileAvailability('model\\M01_001.tgc', index)).toEqual({ status: 'available' });
  });

  it('finds referenced project files by exact path or unique name', () => {
    const index = createProjectFileIndex('Model', ['model\\M01_001.tgc', 'bc\\M01_001.tbc']);

    expect(findProjectFileByReference('model/M01_001.tgc', index)?.path).toBe('model\\M01_001.tgc');
    expect(findProjectFileByReference('M01_001.tbc', index)?.path).toBe('bc\\M01_001.tbc');
  });

  it('does not resolve ambiguous referenced filenames', () => {
    const index = createProjectFileIndex('Model', ['model\\common.tgc', 'other\\common.tgc']);

    expect(findProjectFileByReference('common.tgc', index)).toBeUndefined();
  });

  it('reports missing paths', () => {
    const index = createProjectFileIndex('Model', ['gis\\2d_code.shp']);

    expect(checkProjectFileAvailability('bc\\missing.tbc', index)).toEqual({ status: 'missing' });
  });

  it('marks variable and wildcard paths as uncheckable', () => {
    expect(isUncheckableReference('results\\<<~s1~>>\\plot_*.csv')).toBe(true);
  });

  it('excludes default results and log folders from the index', () => {
    const index = createProjectFileIndex('Model', ['results\\run.log', 'gis\\2d_code.shp', 'LOG\\solver.log']);

    expect(index.files.map((file) => file.path)).toEqual(['gis\\2d_code.shp']);
    expect(checkProjectFileAvailability('results\\run.log', index)).toEqual({ status: 'excluded' });
  });

  it('matches excluded folder names case-insensitively by path segment', () => {
    expect(isPathInsideExcludedFolder('model\\Results\\run.log', ['results'])).toBe(true);
  });

  it('uses results, logs, and check folders as default exclusions', () => {
    expect(defaultExcludedFolderNames).toEqual(['results', 'result', 'log', 'logs', 'check', 'checks']);
  });

  it('identifies readable project files', () => {
    const index = createProjectFileIndex('Model', ['model\\run.tcf', 'runs\\run.log', 'scripts\\run.bat', 'scripts\\run.cmd', 'gis\\2d_code.shp']);

    expect(index.files.map(isReadableProjectFile)).toEqual([true, true, true, true, false]);
  });

  it('uses one readable extension list for file picker filtering', () => {
    expect(readableProjectFileAccept).toBe(readableProjectFileExtensions.join(','));
  });
});
