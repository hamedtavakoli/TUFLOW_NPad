export interface RawTuflowCommandRecord {
  control_file: string;
  command_pattern: string;
  command_variants?: string[];
  value_pattern?: string;
  summary?: string;
  has_value?: boolean;
  solver?: string;
  is_legacy?: boolean | string;
  source_url?: string;
  source_page?: string;
  syntax_warnings?: string[];
}

export interface RawTuflowCommandRow {
  control_file: string;
  command: string;
  command_pattern: string;
  value_pattern?: string;
  summary?: string;
  solver?: string;
  is_legacy?: boolean | string;
  source_url?: string;
  source_page?: string;
}

export interface NormalisedCommandVariant {
  name: string;
  normalisedName: string;
  tokens: string[];
}

export interface NormalisedTuflowCommand {
  id: string;
  controlFile: string;
  commandPattern: string;
  normalisedPattern: string;
  patternTokens: string[];
  variants: NormalisedCommandVariant[];
  valuePattern?: string;
  summary?: string;
  valueSpec: CommandValueSpec;
  hasValue: boolean;
  solver?: string;
  isLegacy: boolean;
  sourceUrl?: string;
  sourcePage?: string;
  syntaxWarnings: string[];
}

export interface TuflowCommandCatalog {
  commands: NormalisedTuflowCommand[];
  variants: Array<NormalisedCommandVariant & { commandId: string; controlFile: string }>;
  duplicateVariants: Array<{ controlFile: string; normalisedName: string; commandIds: string[] }>;
}

export function normaliseCommandText(value: string): string {
  return collapseCommandSpaces(value).toLowerCase();
}

export function commandTokens(value: string): string[] {
  return normaliseCommandText(value).split(' ').filter(Boolean);
}

export function buildTuflowCommandCatalog(records: RawTuflowCommandRecord[]): TuflowCommandCatalog {
  const commands = records.map(normaliseRecord);
  return buildCatalog(commands);
}

export function buildTuflowCommandCatalogFromRows(rows: RawTuflowCommandRow[]): TuflowCommandCatalog {
  const grouped = new Map<string, RawTuflowCommandRecord>();

  rows.forEach((row) => {
    const commandPattern = collapseCommandSpaces(row.command_pattern);
    const valuePattern = row.value_pattern?.trim() || undefined;
    const key = [
      row.control_file.trim().toUpperCase(),
      normaliseCommandText(commandPattern),
      valuePattern ?? '',
      row.source_url ?? ''
    ].join('\u0000');
    const current = grouped.get(key);
    const command = collapseCommandSpaces(row.command);

    if (current) {
      current.command_variants = uniqueStrings([...(current.command_variants ?? []), command]);
      current.summary = current.summary ?? normaliseSummary(row.summary);
      return;
    }

    grouped.set(key, {
      control_file: row.control_file,
      command_pattern: commandPattern,
      command_variants: [command],
      value_pattern: valuePattern,
      summary: normaliseSummary(row.summary),
      has_value: Boolean(valuePattern),
      solver: row.solver,
      is_legacy: row.is_legacy,
      source_url: row.source_url,
      source_page: row.source_page,
      syntax_warnings: []
    });
  });

  return buildTuflowCommandCatalog(Array.from(grouped.values()));
}

function normaliseRecord(record: RawTuflowCommandRecord): NormalisedTuflowCommand {
  const controlFile = record.control_file.trim().toUpperCase();
  const commandPattern = collapseCommandSpaces(record.command_pattern);
  const valuePattern = record.value_pattern?.trim() || undefined;
  const summary = normaliseSummary(record.summary);
  const variants = uniqueStrings(record.command_variants?.length ? record.command_variants : [commandPattern]).map((name) => {
    const collapsedName = collapseCommandSpaces(name);
    return {
      name: collapsedName,
      normalisedName: normaliseCommandText(collapsedName),
      tokens: commandTokens(collapsedName)
    };
  });

  const command: NormalisedTuflowCommand = {
    id: `${controlFile}:${normaliseCommandText(commandPattern)}`,
    controlFile,
    commandPattern,
    normalisedPattern: normaliseCommandText(commandPattern),
    patternTokens: commandTokens(commandPattern),
    variants,
    valuePattern,
    summary,
    valueSpec: classifyValuePattern(valuePattern, record.has_value ?? Boolean(valuePattern)),
    hasValue: record.has_value ?? Boolean(valuePattern),
    solver: record.solver?.trim() || undefined,
    isLegacy: record.is_legacy === true || record.is_legacy === 'true',
    sourceUrl: record.source_url?.trim() || undefined,
    sourcePage: record.source_page?.trim() || undefined,
    syntaxWarnings: record.syntax_warnings ?? []
  };

  return command;
}

function buildCatalog(commands: NormalisedTuflowCommand[]): TuflowCommandCatalog {
  const variants = commands.flatMap((command) =>
    command.variants.map((variant) => ({
      ...variant,
      commandId: command.id,
      controlFile: command.controlFile
    }))
  );
  const byVariant = new Map<string, Set<string>>();

  variants.forEach((variant) => {
    const key = `${variant.controlFile}\u0000${variant.normalisedName}`;
    byVariant.set(key, (byVariant.get(key) ?? new Set()).add(variant.commandId));
  });

  return {
    commands,
    variants,
    duplicateVariants: Array.from(byVariant.entries())
      .filter(([, commandIds]) => commandIds.size > 1)
      .map(([key, commandIds]) => {
        const [controlFile, normalisedName] = key.split('\u0000');
        return { controlFile, normalisedName, commandIds: Array.from(commandIds) };
      })
  };
}

function collapseCommandSpaces(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map(collapseCommandSpaces).filter(Boolean)));
}

function normaliseSummary(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}
import { classifyValuePattern, type CommandValueSpec } from './valuePattern';
