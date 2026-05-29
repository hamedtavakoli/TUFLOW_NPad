import { describe, expect, it } from 'vitest';
import { filterCommandLibrary } from '../lib/commandLibrary';
import type { TuflowCommand } from '../lib/types';

const commands = [
  command({ name: 'Read GIS', syntax: 'Read GIS == <gis file>', summary: 'Read vector GIS layers.', category: 'TGC' }),
  command({ name: 'Geometry Control File', syntax: 'Geometry Control File == <file>', summary: 'Links the model geometry.', category: 'TCF' }),
  command({ name: 'Read Grid', syntax: 'Read Grid == <raster file>', summary: 'Loads raster terrain.', category: 'TGC' }),
  command({ name: 'Legacy Thing', syntax: 'Legacy Thing == <value>', summary: 'Old command.', category: 'TCF', isLegacy: true })
];

describe('command library filtering', () => {
  it('searches by command name', () => {
    expect(filterCommandLibrary(commands, { search: 'read gis', category: 'all', legacy: 'all' }).map((item) => item.name)).toEqual(['Read GIS']);
  });

  it('searches by syntax and summary', () => {
    expect(filterCommandLibrary(commands, { search: 'raster', category: 'all', legacy: 'all' }).map((item) => item.name)).toEqual(['Read Grid']);
  });

  it('filters by category', () => {
    expect(filterCommandLibrary(commands, { search: '', category: 'TCF', legacy: 'all' }).map((item) => item.name)).toEqual([
      'Geometry Control File',
      'Legacy Thing'
    ]);
  });

  it('filters current and legacy commands', () => {
    expect(filterCommandLibrary(commands, { search: '', category: 'all', legacy: 'legacy' }).map((item) => item.name)).toEqual(['Legacy Thing']);
    expect(filterCommandLibrary(commands, { search: '', category: 'all', legacy: 'current' }).map((item) => item.name)).not.toContain('Legacy Thing');
  });
});

function command(command: Partial<TuflowCommand> & Pick<TuflowCommand, 'name' | 'syntax' | 'summary' | 'category'>): TuflowCommand {
  return {
    description: command.summary ?? '',
    allowedFileTypes: [],
    examples: [],
    requiresAssignment: true,
    requiresFileReference: false,
    aliases: [],
    ...command
  };
}
