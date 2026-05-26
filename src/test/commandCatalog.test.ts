import { describe, expect, it } from 'vitest';
import { buildTuflowCommandCatalog, buildTuflowCommandCatalogFromRows, commandTokens, normaliseCommandText } from '../lib/commandCatalog';

describe('command catalog normalisation', () => {
  it('trims, collapses spaces, and matches case-insensitively', () => {
    expect(normaliseCommandText('  Read   GIS   Z Shape  ')).toBe('read gis z shape');
    expect(commandTokens('  Read   GIS   Z Shape  ')).toEqual(['read', 'gis', 'z', 'shape']);
  });

  it('preserves full multi-word variants and adds token lists', () => {
    const catalog = buildTuflowCommandCatalog([
      {
        control_file: 'tgc',
        command_pattern: 'Read Grid Zpts [ {} | ADD ]',
        command_variants: [' Read Grid Zpts ', 'Read Grid Zpts ADD'],
        value_pattern: '[ <grid_file> ]',
        has_value: true,
        is_legacy: 'false'
      }
    ]);

    expect(catalog.commands[0].controlFile).toBe('TGC');
    expect(catalog.commands[0].variants.map((variant) => variant.name)).toEqual(['Read Grid Zpts', 'Read Grid Zpts ADD']);
    expect(catalog.commands[0].variants[1].tokens).toEqual(['read', 'grid', 'zpts', 'add']);
  });

  it('groups flat CSV-shaped rows into one command with variants', () => {
    const catalog = buildTuflowCommandCatalogFromRows([
      {
        control_file: 'TGC',
        command: 'Read Grid Zpts',
        command_pattern: 'Read Grid Zpts [ {} | ADD ]',
        value_pattern: '[ <grid_file> ]',
        is_legacy: 'false'
      },
      {
        control_file: 'TGC',
        command: 'Read Grid Zpts ADD',
        command_pattern: 'Read Grid Zpts [ {} | ADD ]',
        value_pattern: '[ <grid_file> ]',
        is_legacy: 'false'
      }
    ]);

    expect(catalog.commands).toHaveLength(1);
    expect(catalog.variants).toHaveLength(2);
    expect(catalog.duplicateVariants).toEqual([]);
  });
});
