import { classifyInput } from './autocomplete';
import type { InputType, ProjectFileEntry, ProjectFolderEntry } from './types';
import {
  compareTuflowUseCategory,
  getTuflowUseCategories,
  matchTuflowFileTypes,
  type TuflowUseCategory
} from './tuflowFileTypes';

export type ProjectFileViewMode = 'tree' | 'type';

export interface ProjectBrowserFile {
  name: string;
  path: string;
  extension: string;
  type: InputType;
  folder: string;
}

export interface ProjectTypeFileGroup {
  label: string;
  extensions: string[];
  files: ProjectBrowserFile[];
  count: number;
}

export interface ProjectTypeCategoryGroup {
  label: TuflowUseCategory;
  count: number;
  groups: ProjectTypeFileGroup[];
}

export interface ProjectBrowserTreeNode {
  name: string;
  path: string;
  folders: ProjectBrowserTreeNode[];
  files: ProjectBrowserFile[];
  fileCount: number;
}

export interface ProjectBrowserTreeRow {
  kind: 'folder' | 'file';
  path: string;
  depth: number;
}

export interface ProjectBrowserFilters {
  search: string;
  type: string;
  extension: string;
  viewMode: ProjectFileViewMode;
}

export function toProjectBrowserFiles(files: ProjectFileEntry[]): ProjectBrowserFile[] {
  return files.map((file) => {
    const classified = classifyInput(file.name, file.path);
    return {
      ...file,
      extension: file.extension || classified.extension,
      type: classified.type,
      folder: parentFolder(file.path)
    };
  });
}

export function filterProjectBrowserFiles(files: ProjectBrowserFile[], filters: ProjectBrowserFilters): ProjectBrowserFile[] {
  const search = filters.search.trim().toLowerCase();
  return files
    .filter((file) => {
      const matchesSearch =
        !search ||
        file.name.toLowerCase().includes(search) ||
        file.path.toLowerCase().includes(search) ||
        file.extension.toLowerCase().includes(search);
      const matchesType =
        filters.type === 'all' ||
        filters.viewMode !== 'tree' ||
        matchTuflowFileTypes(file).some((match) => match.useCategory === filters.type);
      const matchesExtension = filters.extension === 'all' || file.extension === filters.extension;
      return matchesSearch && matchesType && matchesExtension;
    })
    .sort(compareFiles);
}

export function groupProjectBrowserFilesByTuflowType(files: ProjectBrowserFile[], categoryFilter = 'all'): ProjectTypeCategoryGroup[] {
  const categories = new Map<string, Map<string, ProjectTypeFileGroup>>();

  for (const file of files) {
    for (const match of matchTuflowFileTypes(file)) {
      if (categoryFilter !== 'all' && match.useCategory !== categoryFilter) continue;
      const category = categories.get(match.useCategory) ?? new Map<string, ProjectTypeFileGroup>();
      const key = `${match.fileType}:${match.extensions.join('|')}`;
      const group = category.get(key) ?? {
        label: match.fileType,
        extensions: match.extensions,
        files: [],
        count: 0
      };
      group.files.push(file);
      group.count += 1;
      category.set(key, group);
      categories.set(match.useCategory, category);
    }
  }

  return Array.from(categories.entries())
    .map(([label, groups]) => ({
      label: label as TuflowUseCategory,
      groups: Array.from(groups.values())
        .map((group) => ({ ...group, files: group.files.sort(compareFiles) }))
        .sort((left, right) => left.label.localeCompare(right.label)),
      count: Array.from(groups.values()).reduce((sum, group) => sum + group.count, 0)
    }))
    .sort((left, right) => compareTuflowUseCategory(left.label, right.label));
}

export function buildProjectFileTree(rootName: string, files: ProjectBrowserFile[], folders: ProjectFolderEntry[] = []): ProjectBrowserTreeNode {
  const root: ProjectBrowserTreeNode = {
    name: rootName,
    path: '',
    folders: [],
    files: [],
    fileCount: 0
  };
  const nodes = new Map<string, ProjectBrowserTreeNode>([['', root]]);

  for (const folder of folders) {
    if (files.length === 0 || files.some((file) => file.folder === folder.path || file.folder.startsWith(`${folder.path}\\`))) {
      ensureFolderNode(root, nodes, folder.path);
    }
  }
  for (const file of files) {
    const parent = ensureFolderNode(root, nodes, file.folder === '(root)' ? '' : file.folder);
    parent.files.push(file);
  }

  sortTree(root);
  updateFileCounts(root);
  return root;
}

export function getVisibleProjectTreeRows(node: ProjectBrowserTreeNode, expandedFolders: Set<string>, depth = 0): ProjectBrowserTreeRow[] {
  const rows: ProjectBrowserTreeRow[] = [{ kind: 'folder', path: node.path, depth }];
  if (!expandedFolders.has(node.path)) {
    return rows;
  }

  for (const folder of node.folders) {
    rows.push(...getVisibleProjectTreeRows(folder, expandedFolders, depth + 1));
  }
  for (const file of node.files) {
    rows.push({ kind: 'file', path: file.path, depth: depth + 1 });
  }
  return rows;
}

export function getProjectFileTypes(files: ProjectBrowserFile[]): string[] {
  const available = new Set(files.flatMap((file) => matchTuflowFileTypes(file).map((match) => match.useCategory)));
  return getTuflowUseCategories().filter((category) => available.has(category));
}

export function getProjectFileExtensions(files: ProjectBrowserFile[]): string[] {
  return Array.from(new Set(files.map((file) => file.extension).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function parentFolder(path: string): string {
  const parts = path.split('\\');
  return parts.length > 1 ? parts.slice(0, -1).join('\\') : '(root)';
}

function compareFiles(left: ProjectBrowserFile, right: ProjectBrowserFile): number {
  return left.name.localeCompare(right.name) || left.path.localeCompare(right.path);
}

function ensureFolderNode(root: ProjectBrowserTreeNode, nodes: Map<string, ProjectBrowserTreeNode>, path: string): ProjectBrowserTreeNode {
  if (!path) return root;
  const existing = nodes.get(path);
  if (existing) return existing;

  const parts = path.split('\\');
  const parentPath = parts.slice(0, -1).join('\\');
  const parent = ensureFolderNode(root, nodes, parentPath);
  const node = {
    name: parts.at(-1) ?? path,
    path,
    folders: [],
    files: [],
    fileCount: 0
  };
  parent.folders.push(node);
  nodes.set(path, node);
  return node;
}

function sortTree(node: ProjectBrowserTreeNode) {
  node.folders.sort((left, right) => left.name.localeCompare(right.name));
  node.files.sort(compareFiles);
  node.folders.forEach(sortTree);
}

function updateFileCounts(node: ProjectBrowserTreeNode): number {
  node.fileCount = node.files.length + node.folders.reduce((sum, folder) => sum + updateFileCounts(folder), 0);
  return node.fileCount;
}
