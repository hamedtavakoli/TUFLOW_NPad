import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ExternalLink, FileCheck2, FolderCheck, FolderTree, Layers, RefreshCw, X } from 'lucide-react';
import {
  buildProjectFileTree,
  filterProjectBrowserFiles,
  getProjectFileExtensions,
  getProjectFileTypes,
  groupProjectBrowserFilesByTuflowType,
  toProjectBrowserFiles,
  type ProjectTypeCategoryGroup,
  type ProjectTypeFileGroup,
  type ProjectBrowserTreeNode,
  type ProjectFileViewMode
} from '../lib/projectFileBrowser';
import { isReadableProjectFile } from '../lib/projectFiles';
import type { ProjectFileIndex } from '../lib/types';

interface FilePanelProps {
  projectFileIndex?: ProjectFileIndex;
  projectRootName?: string;
  projectFileCount: number;
  lastIndexedAt?: string;
  validationStatus: string;
  excludedFolderNames: string[];
  onChooseProjectRoot: () => void;
  onRefreshProjectRoot: () => void;
  onRegisterProjectRootFiles: (files: FileList | null) => void;
  onAddExcludedFolder: (name: string) => void;
  onRemoveExcludedFolder: (name: string) => void;
  openProjectPaths: string[];
  onOpenProjectFile: (path: string) => void;
}

export function FilePanel({
  projectFileIndex,
  projectRootName,
  projectFileCount,
  lastIndexedAt,
  validationStatus,
  excludedFolderNames,
  onChooseProjectRoot,
  onRefreshProjectRoot,
  onRegisterProjectRootFiles,
  onAddExcludedFolder,
  onRemoveExcludedFolder,
  openProjectPaths,
  onOpenProjectFile
}: FilePanelProps) {
  const [fileSearch, setFileSearch] = useState('');
  const [viewMode, setViewMode] = useState<ProjectFileViewMode>('tree');
  const [typeFilter, setTypeFilter] = useState('all');
  const [extensionFilter, setExtensionFilter] = useState('all');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']));
  const [expandedTypeRows, setExpandedTypeRows] = useState<Set<string>>(new Set());
  const [showExclusions, setShowExclusions] = useState(false);
  const [excludedDraft, setExcludedDraft] = useState('');
  const browserFiles = useMemo(() => toProjectBrowserFiles(projectFileIndex?.files ?? []), [projectFileIndex]);
  const projectFileByPath = useMemo(
    () => new Map((projectFileIndex?.files ?? []).map((file) => [normalisePanelPath(file.path), file])),
    [projectFileIndex]
  );
  const openProjectPathSet = useMemo(() => new Set(openProjectPaths.map(normalisePanelPath)), [openProjectPaths]);
  const fileTypes = useMemo(() => getProjectFileTypes(browserFiles), [browserFiles]);
  const extensions = useMemo(() => getProjectFileExtensions(browserFiles), [browserFiles]);
  const filteredFiles = useMemo(
    () =>
      filterProjectBrowserFiles(browserFiles, {
        search: fileSearch,
        type: typeFilter,
        extension: extensionFilter,
        viewMode
      }),
    [browserFiles, extensionFilter, fileSearch, typeFilter, viewMode]
  );
  const displayedFiles = filteredFiles;
  const typeGroups = useMemo(() => groupProjectBrowserFilesByTuflowType(displayedFiles, typeFilter), [displayedFiles, typeFilter]);
  const filteredTree = useMemo(
    () => buildProjectFileTree(projectRootName ?? 'Model Root', displayedFiles, projectFileIndex?.folders ?? []),
    [displayedFiles, extensionFilter, fileSearch, projectFileIndex?.folders, projectRootName, typeFilter]
  );
  const visibleTreeRows = useMemo(
    () => flattenTree(filteredTree, expandedFolders),
    [expandedFolders, filteredTree]
  );

  useEffect(() => {
    setExpandedFolders(new Set(['']));
  }, [extensionFilter, fileSearch, typeFilter]);

  return (
    <aside className="file-panel">
      <div className="panel-header">
        <div>
          <h2>Project Files</h2>
          <p>{projectRootName ? 'Model root indexed' : 'No model root'}</p>
        </div>
      </div>

      <div className="project-kicker">Model Root</div>
      <div className="project-actions">
        <label className="project-action primary" title="Choose model root">
          <FolderCheck size={17} />
          Choose Root
          <input
            multiple
            type="file"
            {...{ webkitdirectory: '', directory: '' }}
            onClick={(event) => {
              if ('showDirectoryPicker' in window) {
                event.preventDefault();
                onChooseProjectRoot();
              }
            }}
            onChange={(event) => onRegisterProjectRootFiles(event.target.files)}
          />
        </label>
        <button type="button" className="project-action" onClick={onRefreshProjectRoot} title="Refresh file index">
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="project-root-status">
        <strong>{projectRootName ?? 'No model root selected'}</strong>
        <span>{projectRootName ? `${projectFileCount} indexed files` : 'Choose a model root to check references.'}</span>
        {projectRootName ? <span>Last indexed {lastIndexedAt ?? '-'}</span> : null}
      </div>

      <div className="project-validation-state">{validationStatus}</div>

      <div className="project-file-browser">
        <div className="project-file-browser-head">
          <h3>Project Files</h3>
          <span>{filteredFiles.length} match{filteredFiles.length === 1 ? '' : 'es'}</span>
        </div>
        <input
          className="project-file-search"
          value={fileSearch}
          placeholder="Search name, path, or extension"
          onChange={(event) => setFileSearch(event.target.value)}
        />
        <div className="project-file-view-tabs" role="tablist" aria-label="Project file browser view">
          {[
            { mode: 'tree', label: 'Tree view', icon: FolderTree },
            { mode: 'type', label: 'Type view', icon: Layers }
          ].map(({ mode, label, icon: Icon }) => (
            <button
              type="button"
              className={viewMode === mode ? 'active' : ''}
              key={mode}
              title={label}
              aria-label={label}
              onClick={() => setViewMode(mode as ProjectFileViewMode)}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
        <div className="project-file-filters">
          {viewMode === 'tree' ? (
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">All types</option>
              {fileTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          ) : null}
          <select value={extensionFilter} onChange={(event) => setExtensionFilter(event.target.value)}>
            <option value="all">All extensions</option>
            {extensions.map((extension) => (
              <option key={extension} value={extension}>{extension}</option>
            ))}
          </select>
        </div>

        {!projectFileIndex ? (
          <div className="empty-state compact">No file tree indexed.</div>
        ) : filteredFiles.length === 0 ? (
          <div className="empty-state compact">No files match the current filters.</div>
        ) : viewMode === 'tree' ? (
          <div className="project-file-list tree">
            {visibleTreeRows.map((row) =>
              row.kind === 'folder' ? (
                <button
                  type="button"
                  className="project-tree-folder"
                  key={`folder:${row.node.path}`}
                  style={{ paddingLeft: 7 + row.depth * 14 }}
                  onClick={() => setExpandedFolders((current) => toggleExpanded(current, row.node.path))}
                >
                  <ChevronRight size={14} className={row.isExpanded ? 'expanded' : ''} />
                  <strong>{row.node.name}</strong>
                  <span>{row.node.fileCount}</span>
                </button>
              ) : (
                <ProjectFileRow
                  file={row.file}
                  isOpen={openProjectPathSet.has(normalisePanelPath(row.file.path))}
                  key={row.file.path}
                  onOpenProjectFile={onOpenProjectFile}
                  projectFile={projectFileByPath.get(normalisePanelPath(row.file.path))}
                  style={{ paddingLeft: 7 + row.depth * 14 }}
                />
              )
            )}
          </div>
        ) : (
          <div className="project-file-list tree">
            {typeGroups.map((category) => (
              <TypeCategory
                category={category}
                expandedRows={expandedTypeRows}
                key={category.label}
                onToggle={(key) => setExpandedTypeRows((current) => toggleExpanded(current, key))}
                openProjectPathSet={openProjectPathSet}
                onOpenProjectFile={onOpenProjectFile}
                projectFileByPath={projectFileByPath}
              />
            ))}
          </div>
        )}
      </div>

      <div className="project-exclusions">
        <button type="button" className="project-collapsible-head" onClick={() => setShowExclusions((show) => !show)}>
          <ChevronRight size={14} className={showExclusions ? 'expanded' : ''} />
          <h3>Ignored Folders</h3>
          <span>{excludedFolderNames.length}</span>
        </button>
        {showExclusions ? (
          <>
            <div className="project-exclusion-chips">
              {excludedFolderNames.map((name) => (
                <button type="button" key={name} onClick={() => onRemoveExcludedFolder(name)} title={`Include ${name} on next refresh`}>
                  {name}
                  <X size={12} />
                </button>
              ))}
            </div>
            <form
              className="project-exclusion-add"
              onSubmit={(event) => {
                event.preventDefault();
                onAddExcludedFolder(excludedDraft);
                setExcludedDraft('');
              }}
            >
              <input value={excludedDraft} placeholder="Add folder name" onChange={(event) => setExcludedDraft(event.target.value)} />
              <button type="submit">Add</button>
            </form>
          </>
        ) : null}
      </div>
    </aside>
  );
}

function TypeCategory({
  category,
  expandedRows,
  onToggle,
  openProjectPathSet,
  onOpenProjectFile,
  projectFileByPath
}: {
  category: ProjectTypeCategoryGroup;
  expandedRows: Set<string>;
  onToggle: (key: string) => void;
  openProjectPathSet: Set<string>;
  onOpenProjectFile: (path: string) => void;
  projectFileByPath: Map<string, NonNullable<ProjectFileIndex['files'][number]>>;
}) {
  const categoryKey = `category:${category.label}`;
  const isExpanded = expandedRows.has(categoryKey);

  return (
    <>
      <button type="button" className="project-tree-folder" onClick={() => onToggle(categoryKey)}>
        <ChevronRight size={14} className={isExpanded ? 'expanded' : ''} />
        <strong>{category.label}</strong>
        <span>{category.count}</span>
      </button>
      {isExpanded
        ? category.groups.map((group) => (
            <TypeFileGroup
              categoryLabel={category.label}
              expandedRows={expandedRows}
              group={group}
              key={`${category.label}:${group.label}:${group.extensions.join('|')}`}
              onToggle={onToggle}
              openProjectPathSet={openProjectPathSet}
              onOpenProjectFile={onOpenProjectFile}
              projectFileByPath={projectFileByPath}
            />
          ))
        : null}
    </>
  );
}

function TypeFileGroup({
  categoryLabel,
  group,
  expandedRows,
  onToggle,
  openProjectPathSet,
  onOpenProjectFile,
  projectFileByPath
}: {
  categoryLabel: string;
  group: ProjectTypeFileGroup;
  expandedRows: Set<string>;
  onToggle: (key: string) => void;
  openProjectPathSet: Set<string>;
  onOpenProjectFile: (path: string) => void;
  projectFileByPath: Map<string, NonNullable<ProjectFileIndex['files'][number]>>;
}) {
  const groupKey = `type:${categoryLabel}:${group.label}:${group.extensions.join('|')}`;
  const isExpanded = expandedRows.has(groupKey);

  return (
    <>
      <button type="button" className="project-tree-folder type-child" onClick={() => onToggle(groupKey)}>
        <ChevronRight size={14} className={isExpanded ? 'expanded' : ''} />
        <strong>{group.label} ({group.extensions.join(', ')})</strong>
        <span>{group.count}</span>
      </button>
      {isExpanded
        ? group.files.map((file) => (
            <ProjectFileRow
              file={file}
              isOpen={openProjectPathSet.has(normalisePanelPath(file.path))}
              key={`${groupKey}:${file.path}`}
              onOpenProjectFile={onOpenProjectFile}
              projectFile={projectFileByPath.get(normalisePanelPath(file.path))}
              rowClassName="type-file"
            />
          ))
        : null}
    </>
  );
}

function ProjectFileRow({
  file,
  isOpen,
  onOpenProjectFile,
  projectFile,
  rowClassName = '',
  style
}: {
  file: ReturnType<typeof toProjectBrowserFiles>[number];
  isOpen: boolean;
  onOpenProjectFile: (path: string) => void;
  projectFile: ProjectFileIndex['files'][number] | undefined;
  rowClassName?: string;
  style?: React.CSSProperties;
}) {
  const canOpen = Boolean(projectFile && isReadableProjectFile(projectFile) && projectFile.source);

  return (
    <div className={`project-file-row ${rowClassName}`} title={file.path} style={style}>
      <strong>{file.name}</strong>
      <div className="project-file-row-actions">
        {isOpen ? <span title="Open in editor"><FileCheck2 size={13} /></span> : null}
        {canOpen ? (
          <button type="button" onClick={() => onOpenProjectFile(file.path)} title={isOpen ? 'Show open tab' : 'Open in editor'}>
            <ExternalLink size={13} />
          </button>
        ) : null}
      </div>
      <small>{file.path}</small>
      <span>{file.type}</span>
      <code>{file.extension || '-'}</code>
    </div>
  );
}

type TreeRow =
  | { kind: 'folder'; node: ProjectBrowserTreeNode; depth: number; isExpanded: boolean }
  | { kind: 'file'; file: ReturnType<typeof toProjectBrowserFiles>[number]; depth: number };

function flattenTree(node: ProjectBrowserTreeNode, expandedFolders: Set<string>, depth = 0): TreeRow[] {
  const isExpanded = expandedFolders.has(node.path);
  const rows: TreeRow[] = [{ kind: 'folder', node, depth, isExpanded }];
  if (!isExpanded) return rows;

  for (const folder of node.folders) {
    rows.push(...flattenTree(folder, expandedFolders, depth + 1));
  }
  for (const file of node.files) {
    rows.push({ kind: 'file', file, depth: depth + 1 });
  }
  return rows;
}

function toggleExpanded(current: Set<string>, path: string): Set<string> {
  const next = new Set(current);
  if (next.has(path)) {
    next.delete(path);
  } else {
    next.add(path);
  }
  return next;
}

function normalisePanelPath(path: string): string {
  return path.replaceAll('/', '\\').toLowerCase();
}
