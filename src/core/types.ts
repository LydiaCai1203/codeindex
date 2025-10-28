/**
 * Core data types for the code indexing system
 */

export type Language = 'ts' | 'tsx' | 'js' | 'jsx' | 'python' | 'go' | 'java' | 'rust';

export type SymbolKind = 
  | 'function'
  | 'method'
  | 'class'
  | 'interface'
  | 'struct'
  | 'variable'
  | 'constant'
  | 'property'
  | 'field'
  | 'module'
  | 'namespace'
  | 'type';

export type ReferenceKind = 
  | 'call'
  | 'read'
  | 'write'
  | 'import'
  | 'export'
  | 'extend'
  | 'implement';

export interface Location {
  fileId: number;
  path: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface FileRecord {
  fileId?: number;
  path: string;
  language: Language;
  contentHash: string;
  mtime: number;
  size: number;
}

export interface SymbolRecord {
  symbolId?: number;
  fileId: number;
  language: Language;
  kind: SymbolKind;
  name: string;
  qualifiedName: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  signature?: string;
  exported: boolean;
}

export interface CallRecord {
  callId?: number;
  callerSymbolId: number;
  calleeSymbolId: number;
  siteFileId: number;
  siteStartLine: number;
  siteStartCol: number;
  siteEndLine: number;
  siteEndCol: number;
}

export interface ReferenceRecord {
  refId?: number;
  fromFileId: number;
  fromStartLine: number;
  fromStartCol: number;
  fromEndLine: number;
  fromEndCol: number;
  toSymbolId: number;
  refKind: ReferenceKind;
}

export interface IndexOptions {
  rootDir: string;
  dbPath: string;
  languages: Language[];
  include?: string[];
  exclude?: string[];
  concurrency?: number;
  maxNestedStructDepth?: number; // 嵌套结构体的最大索引深度，默认为 3
}

export interface QuerySymbolOptions {
  name: string;
  language?: Language;
  inFile?: string;
  kind?: SymbolKind;
}

export interface CallChainOptions {
  from: number; // symbolId
  direction?: 'forward' | 'backward';
  depth?: number;
}

export interface CallNode {
  symbolId: number;
  name: string;
  qualifiedName: string;
  location: Location;
  depth: number;
  children?: CallNode[];
}

export interface PropertyNode {
  name: string;
  kind: SymbolKind;
  location: Location;
  signature?: string;
  visibility?: string;
}

