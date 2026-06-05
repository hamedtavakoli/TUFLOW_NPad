import { getExtension } from './parser';
import type { ProjectFileEntry, ProjectFileIndex, ProjectFolderEntry, ProjectInput } from './types';

interface FileSystemFileLike {
  kind: 'file';
  name: string;
  getFile?: () => Promise<File>;
}

interface FileSystemDirectoryLike {
  kind: 'directory';
  name: string;
  values(): AsyncIterable<FileSystemFileLike | FileSystemDirectoryLike>;
}

export interface ProjectFileAvailability {
  status: 'available' | 'missing' | 'uncheckable' | 'excluded';
}

export const defaultExcludedFolderNames = ['results', 'result', 'log', 'logs', 'check', 'checks'];
export const readableProjectFileExtensions = [
  '.2dm',
  '.adcf',
  '.asc',
  '.bat',
  '.cfg',
  '.cmd',
  '.csv',
  '.dat',
  '.ecf',
  '.eof',
  '.erd',
  '.erf',
  '.ini',
  '.log',
  '.mid',
  '.mif',
  '.qcf',
  '.rdf',
  '.sup',
  '.tbc',
  '.tcf',
  '.tef',
  '.tesf',
  '.tgc',
  '.toc',
  '.tpc',
  '.trd',
  '.trfc',
  '.tscf',
  '.tsf',
  '.tmf',
  '.tsoilf',
  '.txt',
  '.tlf'
];
export const readableProjectFileAccept = readableProjectFileExtensions.join(',');

interface ProjectFileIndexOptions {
  folders?: string[];
  excludedFolderNames?: string[];
  sources?: Map<string, ProjectFileEntry['source']>;
}

export function createProjectFileIndex(rootName: string, paths: string[], options: ProjectFileIndexOptions = {}): ProjectFileIndex {
  const excludedFolderNames = normaliseExcludedFolderNames(options.excludedFolderNames ?? defaultExcludedFolderNames);
  const folderPaths = new Set<string>();
  const files = paths
    .map(normaliseProjectPath)
    .filter((path): path is string => Boolean(path))
    .filter((path) => !isPathInsideExcludedFolder(path, excludedFolderNames))
    .map<ProjectFileEntry>((path) => ({
      name: path.split('\\').at(-1) ?? path,
      path,
      extension: getExtension(path),
      source: options.sources?.get(path.toLowerCase())
    }));

  for (const file of files) {
    for (const folder of parentFolders(file.path)) {
      folderPaths.add(folder);
    }
  }
  for (const folder of options.folders ?? []) {
    const normalised = normaliseProjectPath(folder);
    if (normalised && !isPathInsideExcludedFolder(normalised, excludedFolderNames)) {
      folderPaths.add(normalised);
    }
  }

  const folders = Array.from(folderPaths)
    .sort((left, right) => left.localeCompare(right))
    .map<ProjectFolderEntry>((path) => ({
      name: path.split('\\').at(-1) ?? path,
      path
    }));

  return {
    rootName,
    files,
    folders,
    excludedFolderNames,
    pathSet: new Set(files.map((file) => file.path.toLowerCase())),
    nameSet: new Set(files.map((file) => file.name.toLowerCase()))
  };
}

export function createProjectFileIndexFromInputs(rootName: string, inputs: ProjectInput[]): ProjectFileIndex {
  return createProjectFileIndex(rootName, inputs.map((input) => input.path));
}

export function mergeProjectFileIndexes(rootName: string, indexes: Array<ProjectFileIndex | undefined>): ProjectFileIndex {
  return createProjectFileIndex(rootName, indexes.flatMap((index) => index?.files.map((file) => file.path) ?? []), {
    folders: indexes.flatMap((index) => index?.folders.map((folder) => folder.path) ?? []),
    excludedFolderNames: indexes.find(Boolean)?.excludedFolderNames
  });
}

export function normaliseProjectPath(path: string): string {
  return path
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
    .replaceAll('/', '\\')
    .replace(/^\.\\+/, '')
    .replace(/^\\+/, '')
    .replace(/\\+/g, '\\');
}

export function checkProjectFileAvailability(reference: string, index: ProjectFileIndex): ProjectFileAvailability {
  const normalised = normaliseProjectPath(reference);
  if (!normalised || isUncheckableReference(normalised)) {
    return { status: 'uncheckable' };
  }
  if (isPathInsideExcludedFolder(normalised, index.excludedFolderNames)) {
    return { status: 'excluded' };
  }

  const pathKey = normalised.toLowerCase();
  const nameKey = pathKey.split('\\').at(-1) ?? pathKey;

  return index.pathSet.has(pathKey) || index.nameSet.has(nameKey)
    ? { status: 'available' }
    : { status: 'missing' };
}

export function findProjectFileByReference(reference: string, index: ProjectFileIndex): ProjectFileEntry | undefined {
  const normalised = normaliseProjectPath(reference);
  if (!normalised || isUncheckableReference(normalised) || isPathInsideExcludedFolder(normalised, index.excludedFolderNames)) {
    return undefined;
  }

  const pathKey = normalised.toLowerCase();
  const exactMatch = index.files.find((file) => file.path.toLowerCase() === pathKey);
  if (exactMatch) return exactMatch;

  const nameKey = pathKey.split('\\').at(-1) ?? pathKey;
  const nameMatches = index.files.filter((file) => file.name.toLowerCase() === nameKey);
  return nameMatches.length === 1 ? nameMatches[0] : undefined;
}

export function isUncheckableReference(reference: string): boolean {
  return /<<[^>]+>>|~[^~]+~|[*?]/.test(reference);
}

export function isPathInsideExcludedFolder(path: string, excludedFolderNames: string[]): boolean {
  const excluded = new Set(normaliseExcludedFolderNames(excludedFolderNames));
  return normaliseProjectPath(path)
    .split('\\')
    .some((segment) => excluded.has(segment.toLowerCase()));
}

export function normaliseExcludedFolderNames(folderNames: string[]): string[] {
  return Array.from(new Set(folderNames.map((name) => name.trim().replace(/[\\/]+/g, '').toLowerCase()).filter(Boolean))).sort();
}

export function isReadableProjectFile(file: ProjectFileEntry): boolean {
  return readableProjectFileExtensions.includes(file.extension.toLowerCase());
}

export async function createProjectFileIndexFromDirectoryHandle(
  handle: FileSystemDirectoryLike,
  excludedFolderNames = defaultExcludedFolderNames
): Promise<ProjectFileIndex> {
  const paths: string[] = [];
  const folders: string[] = [];
  const sources = new Map<string, ProjectFileEntry['source']>();
  const normalisedExclusions = normaliseExcludedFolderNames(excludedFolderNames);
  await collectDirectoryPaths(handle, '', paths, folders, normalisedExclusions, sources);
  return createProjectFileIndex(handle.name, paths, { folders, excludedFolderNames: normalisedExclusions, sources });
}

export function createProjectFileIndexFromFileList(files: FileList, excludedFolderNames = defaultExcludedFolderNames): ProjectFileIndex {
  const selectedFiles = Array.from(files);
  const paths = selectedFiles.map((file) => file.webkitRelativePath || file.name);
  const firstPath = paths[0] ?? 'Project Root';
  const rootName = firstPath.includes('/') ? firstPath.split('/')[0] : 'Project Root';
  const relativePaths = paths.map((path) => path.split('/').slice(1).join('/') || path);
  const sources = new Map<string, ProjectFileEntry['source']>();
  for (const [index, path] of relativePaths.entries()) {
    sources.set(normaliseProjectPath(path).toLowerCase(), { kind: 'file', file: selectedFiles[index] });
  }
  return createProjectFileIndex(rootName, relativePaths, {
    sources,
    excludedFolderNames
  });
}

async function collectDirectoryPaths(
  handle: FileSystemDirectoryLike,
  basePath: string,
  paths: string[],
  folders: string[],
  excludedFolderNames: string[],
  sources: Map<string, ProjectFileEntry['source']>
) {
  for await (const child of handle.values()) {
    const childPath = basePath ? `${basePath}\\${child.name}` : child.name;
    if (child.kind === 'file') {
      paths.push(childPath);
      if (child.getFile) {
        sources.set(normaliseProjectPath(childPath).toLowerCase(), { kind: 'handle', handle: child as FileSystemFileHandle });
      }
    } else if (!isPathInsideExcludedFolder(childPath, excludedFolderNames)) {
      folders.push(childPath);
      await collectDirectoryPaths(child, childPath, paths, folders, excludedFolderNames, sources);
    }
  }
}

function parentFolders(path: string): string[] {
  const parts = path.split('\\').slice(0, -1);
  return parts.map((_, index) => parts.slice(0, index + 1).join('\\'));
}
