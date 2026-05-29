import { describe, expect, it } from 'vitest';
import {
  buildProjectFileTree,
  filterProjectBrowserFiles,
  getVisibleProjectTreeRows,
  groupProjectBrowserFilesByTuflowType,
  toProjectBrowserFiles
} from '../lib/projectFileBrowser';
import type { ProjectFileEntry } from '../lib/types';

const files: ProjectFileEntry[] = [
  { name: 'M01.tcf', path: 'M01.tcf', extension: '.tcf' },
  { name: '2d_code.shp', path: 'gis\\2d_code.shp', extension: '.shp' },
  { name: 'dem.asc', path: 'grids\\dem.asc', extension: '.asc' },
  { name: 'materials.tmf', path: 'materials\\materials.tmf', extension: '.tmf' }
];

describe('project file browser', () => {
  it('builds a nested tree with root-level files and folders', () => {
    const tree = buildProjectFileTree('Model', toProjectBrowserFiles(files));

    expect(tree.files.map((file) => file.name)).toEqual(['M01.tcf']);
    expect(tree.folders.map((folder) => folder.path)).toEqual(['gis', 'grids', 'materials']);
    expect(tree.fileCount).toBe(4);
  });

  it('keeps parent folders and matching counts when built from filtered files', () => {
    const browserFiles = toProjectBrowserFiles([
      { name: 'roughness.shp', path: 'gis\\materials\\roughness.shp', extension: '.shp' },
      { name: 'notes.txt', path: 'docs\\notes.txt', extension: '.txt' }
    ]);
    const filtered = filterProjectBrowserFiles(browserFiles, {
      search: '',
      type: 'Input File',
      extension: 'all',
      viewMode: 'tree'
    });
    const tree = buildProjectFileTree('Model', filtered, [
      { name: 'gis', path: 'gis' },
      { name: 'materials', path: 'gis\\materials' },
      { name: 'docs', path: 'docs' }
    ]);

    expect(tree.folders.map((folder) => [folder.path, folder.fileCount])).toEqual([['gis', 1]]);
    expect(tree.folders[0].folders.map((folder) => [folder.path, folder.fileCount])).toEqual([['gis\\materials', 1]]);
  });

  it('keeps matching search branches collapsed until expanded by the user', () => {
    const browserFiles = toProjectBrowserFiles([
      { name: 'roughness.shp', path: 'gis\\materials\\roughness.shp', extension: '.shp' }
    ]);
    const filtered = filterProjectBrowserFiles(browserFiles, {
      search: 'roughness',
      type: 'all',
      extension: 'all',
      viewMode: 'tree'
    });
    const tree = buildProjectFileTree('Model', filtered, [
      { name: 'gis', path: 'gis' },
      { name: 'materials', path: 'gis\\materials' }
    ]);

    expect(getVisibleProjectTreeRows(tree, new Set([''])).map((row) => row.path)).toEqual(['', 'gis']);
  });

  it('groups ambiguous formats under each documented use category', () => {
    const groups = groupProjectBrowserFilesByTuflowType(toProjectBrowserFiles([
      { name: '2d_code.shp', path: 'gis\\2d_code.shp', extension: '.shp' }
    ]));

    expect(groups.map((group) => [group.label, group.count])).toEqual([
      ['Input File', 1],
      ['Output File', 1],
      ['Check File', 1]
    ]);
  });

  it('filters by search text across path and extension', () => {
    const filtered = filterProjectBrowserFiles(toProjectBrowserFiles(files), {
      search: '.shp',
      type: 'all',
      extension: 'all',
      viewMode: 'tree'
    });

    expect(filtered.map((file) => file.path)).toEqual(['gis\\2d_code.shp']);
  });

  it('ignores category filters outside tree view', () => {
    const filtered = filterProjectBrowserFiles(toProjectBrowserFiles(files), {
      search: '',
      type: 'Control File',
      extension: 'all',
      viewMode: 'type'
    });

    expect(filtered.map((file) => file.name)).toEqual(['2d_code.shp', 'dem.asc', 'M01.tcf', 'materials.tmf']);
  });

  it('filters by extension', () => {
    const filtered = filterProjectBrowserFiles(toProjectBrowserFiles(files), {
      search: '',
      type: 'all',
      extension: '.asc',
      viewMode: 'tree'
    });

    expect(filtered.map((file) => file.name)).toEqual(['dem.asc']);
  });

  it('filters tree files by TUFLOW use category membership', () => {
    const filtered = filterProjectBrowserFiles(toProjectBrowserFiles(files), {
      search: '',
      type: 'Control File',
      extension: 'all',
      viewMode: 'tree'
    });

    expect(filtered.map((file) => file.name)).toEqual(['M01.tcf']);
  });

  it('allows ambiguous formats in multiple tree category filters', () => {
    const browserFiles = toProjectBrowserFiles([{ name: '2d_code.shp', path: 'gis\\2d_code.shp', extension: '.shp' }]);

    expect(filterProjectBrowserFiles(browserFiles, { search: '', type: 'Input File', extension: 'all', viewMode: 'tree' })).toHaveLength(1);
    expect(filterProjectBrowserFiles(browserFiles, { search: '', type: 'Output File', extension: 'all', viewMode: 'tree' })).toHaveLength(1);
    expect(filterProjectBrowserFiles(browserFiles, { search: '', type: 'Check File', extension: 'all', viewMode: 'tree' })).toHaveLength(1);
  });
});
