export type Severity = 'error' | 'warning' | 'info';

export interface TuflowCommand {
  name: string;
  syntax: string;
  description: string;
  category: string;
  allowedFileTypes: string[];
  examples: string[];
  requiresAssignment: boolean;
  requiresFileReference: boolean;
  aliases: string[];
  duplicatePolicy?: 'allow' | 'warn';
}

export interface ProjectInput {
  id: string;
  name: string;
  path: string;
  type: InputType;
  extension: string;
}

export type InputType =
  | 'GIS'
  | 'Raster'
  | 'Terrain'
  | 'Boundary'
  | 'Materials'
  | 'Rainfall'
  | 'Control'
  | 'Folder'
  | 'Other';

export interface ParsedLine {
  lineNumber: number;
  raw: string;
  trimmed: string;
  isBlank: boolean;
  isComment: boolean;
  commandText: string;
  parameterText: string;
  hasAssignment: boolean;
  reference?: string;
  placeholders: string[];
}

export interface Problem {
  id: string;
  lineNumber: number;
  severity: Severity;
  message: string;
  suggestion?: string;
}

export interface Suggestion {
  label: string;
  detail: string;
  insertText: string;
  kind: 'command' | 'file' | 'keyword' | 'snippet';
}
