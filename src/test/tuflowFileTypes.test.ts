import { describe, expect, it } from 'vitest';
import { matchTuflowFileTypes } from '../lib/tuflowFileTypes';
import type { ProjectBrowserFile } from '../lib/projectFileBrowser';

function file(name: string, extension: string): ProjectBrowserFile {
  return {
    name,
    path: name,
    extension,
    type: 'Other',
    folder: '(root)'
  };
}

describe('TUFLOW file type catalog', () => {
  it('maps shapefile components to input, output, and check categories', () => {
    const matches = matchTuflowFileTypes(file('2d_code.shp', '.shp'));

    expect(matches.map((match) => [match.useCategory, match.fileType])).toEqual([
      ['Input File', 'ArcGIS Shapefile Layers'],
      ['Output File', 'ArcGIS Shapefile Layers'],
      ['Check File', 'ArcGIS Shapefile Layers']
    ]);
  });

  it('maps TCF files to the simulation control file type', () => {
    const matches = matchTuflowFileTypes(file('model.tcf', '.tcf'));

    expect(matches.map((match) => [match.useCategory, match.fileType])).toEqual([
      ['Control File', 'TUFLOW Simulation Control File']
    ]);
  });

  it('maps unknown extensions to Other', () => {
    const matches = matchTuflowFileTypes(file('readme.md', '.md'));

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      useCategory: 'Other',
      fileType: 'Unknown / Unmapped'
    });
  });
});
