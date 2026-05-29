import type { ProjectBrowserFile } from './projectFileBrowser';

export type TuflowUseCategory = 'Control File' | 'Input File' | 'Output File' | 'Check File' | 'Other';

export interface TuflowFileTypeRecord {
  useCategory: TuflowUseCategory;
  fileType: string;
  extensions: string[];
  order: number;
}

export interface TuflowFileTypeMatch extends TuflowFileTypeRecord {
  file: ProjectBrowserFile;
}

const categoryOrder: TuflowUseCategory[] = ['Control File', 'Input File', 'Output File', 'Check File', 'Other'];

export const tuflowFileTypeCatalog: TuflowFileTypeRecord[] = [
  record('Control File', 'TUFLOW Simulation Control File', ['.tcf'], 10),
  record('Control File', 'TUFLOW Boundary Conditions Control File', ['.tbc'], 20),
  record('Control File', 'TUFLOW Event File', ['.tef'], 30),
  record('Control File', 'TUFLOW Geometry Control File', ['.tgc'], 40),
  record('Control File', 'TUFLOW Quadtree Control File', ['.qcf'], 50),
  record('Control File', 'ESTRY Simulation Control File', ['.ecf'], 60),
  record('Control File', 'TUFLOW Operating Controls File', ['.toc'], 70),
  record('Control File', 'TUFLOW Rainfall Control File', ['.trfc'], 80),
  record('Control File', 'TUFLOW AD Control File', ['.adcf'], 90),
  record('Control File', 'TUFLOW External Stress File', ['.tesf'], 100),
  record('Control File', 'Read Files', ['.trd', '.erd', '.rdf'], 110),
  record('Input File', 'TUFLOW Materials File', ['.tmf', '.csv'], 200),
  record('Input File', 'TUFLOW Soils File', ['.tsoilf'], 210),
  record('Input File', 'TUFLOW Restart File', ['.trf'], 220),
  record('Output File', 'TUFLOW Restart File', ['.trf'], 230),
  record('Input File', 'ESTRY Restart File', ['.erf'], 240),
  record('Output File', 'ESTRY Restart File', ['.erf'], 250),
  record('Input File', 'Comma Delimited Files', ['.csv'], 260),
  record('Output File', 'Comma Delimited Files', ['.csv'], 270),
  record('Check File', 'Comma Delimited Files', ['.csv'], 280),
  record('Input File', 'ArcGIS Shapefile Layers', ['.shp', '.dbf', '.shx', '.prj'], 290),
  record('Output File', 'ArcGIS Shapefile Layers', ['.shp', '.dbf', '.shx', '.prj'], 300),
  record('Check File', 'ArcGIS Shapefile Layers', ['.shp', '.dbf', '.shx', '.prj'], 310),
  record('Input File', 'MapInfo MIF/MID Files', ['.mif', '.mid'], 320),
  record('Output File', 'MapInfo MIF/MID Files', ['.mif', '.mid'], 330),
  record('Check File', 'MapInfo MIF/MID Files', ['.mif', '.mid'], 340),
  record('Input File', 'Geopackage', ['.gpkg'], 350),
  record('Output File', 'Geopackage', ['.gpkg'], 360),
  record('Check File', 'Geopackage', ['.gpkg'], 370),
  record('Input File', 'ESRI Ascii raster grid', ['.asc'], 380),
  record('Output File', 'ESRI Ascii raster grid', ['.asc'], 390),
  record('Check File', 'ESRI Ascii raster grid', ['.asc'], 400),
  record('Input File', 'Binary Float Grid', ['.flt'], 410),
  record('Output File', 'Binary Float Grid', ['.flt'], 420),
  record('Check File', 'Binary Float Grid', ['.flt'], 430),
  record('Input File', 'GeoTIFF', ['.tif'], 440),
  record('Output File', 'GeoTIFF', ['.tif'], 450),
  record('Check File', 'GeoTIFF', ['.tif'], 460),
  record('Input File', 'NetCDF', ['.nc'], 470),
  record('Output File', 'NetCDF', ['.nc'], 480),
  record('Output File', 'SMS Super File', ['.sup'], 490),
  record('Output File', 'SMS Mesh File', ['.2dm'], 500),
  record('Output File', 'SMS Data File', ['.dat'], 510),
  record('Output File', 'SMS XMDF File', ['.xmdf'], 520),
  record('Output File', 'WaterRIDE', ['.wrb', '.wrc', '.wrr'], 530),
  record('Output File', 'BlueKenue', ['.t3s', '.t3v'], 540),
  record('Output File', '12D Civil Solutions', ['.tmo', '.tgo'], 550),
  record('Check File', 'TUFLOW Log File', ['.tlf'], 560),
  record('Check File', 'TUFLOW Summary File', ['.tsf'], 570),
  record('Check File', 'ESTRY Output File', ['.eof'], 580)
];

export function matchTuflowFileTypes(file: ProjectBrowserFile): TuflowFileTypeMatch[] {
  const matches = tuflowFileTypeCatalog
    .filter((record) => record.extensions.includes(file.extension.toLowerCase()))
    .map((record) => ({ ...record, file }));

  return matches.length > 0 ? matches : [{ ...record('Other', 'Unknown / Unmapped', [file.extension || '-'], 1000), file }];
}

export function getTuflowUseCategories(): TuflowUseCategory[] {
  return categoryOrder;
}

export function compareTuflowUseCategory(left: string, right: string): number {
  return categoryRank(left) - categoryRank(right) || left.localeCompare(right);
}

function record(useCategory: TuflowUseCategory, fileType: string, extensions: string[], order: number): TuflowFileTypeRecord {
  return {
    useCategory,
    fileType,
    extensions,
    order
  };
}

function categoryRank(category: string): number {
  const index = categoryOrder.indexOf(category as TuflowUseCategory);
  return index >= 0 ? index : categoryOrder.length;
}
