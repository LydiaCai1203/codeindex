/**
 * CodeIndex JavaScript SDK
 *
 * 这里直接复用根目录的 CodeIndex，实现一个更语义化的入口，
 * 方便在独立 npm 包中发布使用。
 */
export { CodeIndex } from '../../src/index.js';
export type {
  IndexOptions,
  QuerySymbolOptions,
  CallChainOptions,
  CallNode,
  Location,
  SymbolRecord,
  PropertyNode,
  Language,
  SymbolKind,
} from '../../src/index.js';

