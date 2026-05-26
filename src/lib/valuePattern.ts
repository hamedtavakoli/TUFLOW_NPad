export type ValueKind = 'file' | 'folder' | 'gis' | 'number' | 'option' | 'string' | 'list' | 'variable' | 'compound' | 'unknown';

export interface CommandValueSpec {
  expectsValue: boolean;
  rawPattern?: string;
  kinds: ValueKind[];
  options: string[];
  defaultValue?: string;
  extensions: string[];
  placeholders: string[];
  allowsMultiple: boolean;
  note?: string;
}

const numberPlaceholderWords = new Set([
  'angle',
  'cell size',
  'distance',
  'factor',
  'h_tol',
  'height',
  'level',
  'max',
  'min',
  'n_factor',
  'period',
  'rate',
  'speed',
  'time',
  'value',
  'value_in_metres',
  'width'
]);

export function classifyValuePattern(pattern: string | undefined, expectsValue = Boolean(pattern?.trim())): CommandValueSpec {
  const rawPattern = pattern?.trim() || undefined;
  if (!expectsValue) {
    return {
      expectsValue: false,
      rawPattern,
      kinds: [],
      options: [],
      extensions: [],
      placeholders: [],
      allowsMultiple: false
    };
  }

  const source = rawPattern ?? '';
  const lowerSource = source.toLowerCase();
  const semanticSource = lowerSource.replace(/[_-]/g, ' ');
  const placeholders = extractPlaceholders(source);
  const extensions = extractExtensions(lowerSource);
  const defaultValue = extractDefaultValue(source);
  const options = extractOptions(source, placeholders);
  const kinds = new Set<ValueKind>();

  if (extensions.length > 0 || /\b(file|database)\b/.test(semanticSource)) kinds.add('file');
  if (/\bfolder\b/.test(semanticSource)) kinds.add('folder');
  if (/\bgis layer\b/.test(semanticSource)) {
    kinds.add('gis');
    kinds.add('file');
  }
  if (placeholders.some((placeholder) => isFreeTextPlaceholder(placeholder)) || /\bprojection line\b/.test(semanticSource)) kinds.add('string');
  if (placeholders.some((placeholder) => isListPlaceholder(placeholder))) kinds.add('list');
  if (placeholders.some((placeholder) => isNumberPlaceholder(placeholder))) kinds.add('number');
  if (defaultValue && isNumeric(defaultValue)) kinds.add('number');
  if (options.length > 0) kinds.add('option');
  if (/"[^"]*"|'[^']*'/.test(source)) kinds.add('string');
  if (/<<[^>]+>>|~[^~]+~/.test(source)) kinds.add('variable');
  if (allowsMultipleValues(source)) kinds.add('list');
  if (kinds.size > 1 || /\|/.test(source) || /\[[^\]]+\[/.test(source)) kinds.add('compound');
  if (kinds.size === 0) kinds.add('unknown');

  return {
    expectsValue: true,
    rawPattern,
    kinds: Array.from(kinds),
    options,
    defaultValue,
    extensions,
    placeholders,
    allowsMultiple: allowsMultipleValues(source)
  };
}

function extractOptions(pattern: string, placeholders: string[]): string[] {
  const bracketOptions = Array.from(pattern.matchAll(/\[([^\]]+)\]/g), (match) => match[1]);
  const optionText = bracketOptions.length > 0 ? bracketOptions.join(' | ') : pattern.includes('|') ? pattern : '';
  if (!optionText) return [];
  const hasTypedPlaceholder = placeholders.length > 0;

  return uniqueStrings(
    optionText
      .split('|')
      .map((option) => cleanOption(option))
      .filter((option) => Boolean(option) && option !== '.' && !isPlaceholder(option) && !/^\.[a-z][a-z0-9]*(?:_file)?$/i.test(option))
      .filter((option) => !(hasTypedPlaceholder && isNumeric(option)))
  );
}

function extractDefaultValue(pattern: string): string | undefined {
  const match = pattern.match(/\{([^}]+)\}/);
  return match ? cleanOption(match[1]) || undefined : undefined;
}

function extractPlaceholders(pattern: string): string[] {
  const placeholders = [
    ...Array.from(pattern.matchAll(/⟨\s*([^⟩]+?)\s*⟩/g), (match) => match[1]),
    ...Array.from(pattern.matchAll(/<\s*([^>]+?)\s*>/g), (match) => match[1]),
    ...Array.from(pattern.matchAll(/\?\s*([^?]+?)\s*\?/g), (match) => match[1])
  ];
  return uniqueStrings(placeholders.map((placeholder) => placeholder.trim()));
}

function extractExtensions(pattern: string): string[] {
  const extensions = new Set<string>();
  const semanticPattern = pattern.replace(/[_-]/g, ' ');
  for (const match of pattern.matchAll(/\.[a-z][a-z0-9]*(?:_file)?\b/g)) {
    extensions.add(match[0].replace(/_file$/, ''));
  }
  if (/\bgis layer\b/.test(semanticPattern)) {
    ['.shp', '.mif', '.gpkg', '.json', '.geojson'].forEach((extension) => extensions.add(extension));
  }
  if (/\bgrid\b|\braster\b/.test(semanticPattern)) {
    ['.asc', '.flt', '.tif', '.tiff', '.dem', '.grd'].forEach((extension) => extensions.add(extension));
  }
  if (/\btin\b/.test(semanticPattern)) {
    ['.tin', '.12da', '.xml'].forEach((extension) => extensions.add(extension));
  }
  if (/\bcsv\b/.test(semanticPattern)) {
    extensions.add('.csv');
  }
  return Array.from(extensions).sort();
}

function allowsMultipleValues(pattern: string): boolean {
  return /,\s*(?:v\d+|…|\.\.\.)/i.test(pattern) || /\blist\b/i.test(pattern);
}

function isNumberPlaceholder(placeholder: string): boolean {
  const normalised = placeholder.toLowerCase().replace(/[<>]/g, '').trim();
  return numberPlaceholderWords.has(normalised) || /\b(value|distance|time|timestep|seconds|height|width|level|factor|period|speed|rate|size|maximum|minimum|min|max)\b/.test(normalised);
}

function isFreeTextPlaceholder(placeholder: string): boolean {
  const normalised = placeholder.toLowerCase().replace(/[<>]/g, '').replace(/[_-]/g, ' ').trim();
  if (isNumberPlaceholder(placeholder) || isFilePlaceholder(normalised)) {
    return false;
  }
  return true;
}

function isListPlaceholder(placeholder: string): boolean {
  const normalised = placeholder.toLowerCase().replace(/[<>]/g, '').replace(/[_-]/g, ' ').trim();
  return /\b(formats?|types?|options?|values?|items?|list)\b/.test(normalised);
}

function isFilePlaceholder(normalised: string): boolean {
  return /\b(file|folder|layer|database|gis|grid|raster|tin|csv)\b/.test(normalised) || /^\.[a-z][a-z0-9]*(?: file)?$/i.test(normalised);
}

function cleanOption(option: string): string {
  return option
    .replace(/[{}[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPlaceholder(value: string): boolean {
  return /[?⟨⟩<>]/.test(value) || /^\w+_(?:file|layer)$/.test(value.toLowerCase());
}

function isNumeric(value: string): boolean {
  return /^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?%?$/i.test(value.trim());
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
