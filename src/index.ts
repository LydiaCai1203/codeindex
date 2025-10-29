/**
 * Main API entry point for CodeIndex
 */

import { Indexer } from './indexer/indexer.js';
import { QueryEngine } from './query/query-engine.js';
import type {
  IndexOptions,
  QuerySymbolOptions,
  CallChainOptions,
  CallNode,
  Location,
  SymbolRecord,
  PropertyNode,
} from './core/types.js';

export class CodeIndex {
  private indexer: Indexer;
  private queryEngine: QueryEngine;
  private initialized = false;
  private db: ReturnType<typeof this.indexer.getDatabase>;

  private constructor(private options: IndexOptions) {
    this.indexer = new Indexer(options);
    this.db = this.indexer.getDatabase();
    this.queryEngine = new QueryEngine(this.db);
  }

  /**
   * Create a new CodeIndex instance
   */
  static async create(options: IndexOptions): Promise<CodeIndex> {
    const instance = new CodeIndex(options);
    await instance.init();
    return instance;
  }

  private async init(): Promise<void> {
    await this.indexer.init();
    this.initialized = true;
  }

  /**
   * Reindex all files in the workspace
   */
  async reindexAll(onProgress?: (current: number, total: number) => void): Promise<void> {
    if (!this.initialized) {
      throw new Error('CodeIndex not initialized');
    }
    await this.indexer.indexAll(onProgress);
  }

  /**
   * Clear all existing data and rebuild the index from scratch
   */
  async rebuild(onProgress?: (current: number, total: number) => void): Promise<void> {
    if (!this.initialized) {
      throw new Error('CodeIndex not initialized');
    }
    if (!onProgress) {
      console.log('Clearing existing index...');
    }
    this.indexer.getDatabase().clearAll();
    if (!onProgress) {
      console.log('Rebuilding index...');
    }
    await this.indexer.indexAll(onProgress);
    if (!onProgress) {
      console.log('Vacuuming database...');
    }
    this.indexer.getDatabase().vacuum();
    if (!onProgress) {
      console.log('Rebuild complete!');
    }
  }

  /**
   * Update specific files
   */
  async updateFiles(paths: string[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('CodeIndex not initialized');
    }
    for (const path of paths) {
      await this.indexer.indexFile(path);
    }
  }

  /**
   * Find a single symbol by name
   */
  async findSymbol(query: QuerySymbolOptions): Promise<SymbolRecord | null> {
    return this.queryEngine.findSymbol(query);
  }

  /**
   * Find all symbols matching the query
   */
  async findSymbols(query: QuerySymbolOptions): Promise<SymbolRecord[]> {
    return this.queryEngine.findSymbols(query);
  }

  /**
   * Build a call chain starting from a symbol
   */
  async callChain(options: CallChainOptions): Promise<CallNode | null> {
    return this.queryEngine.buildCallChain(options);
  }

  /**
   * Get properties/methods of an object/class/struct
   */
  async objectProperties(query: { object: string; inFile?: string; language?: string }): Promise<PropertyNode[]> {
    const properties = this.queryEngine.getObjectProperties(query.object, query.language);
    
    return properties.map(prop => ({
      name: prop.name,
      kind: prop.kind,
      location: this.db.getSymbolLocation(prop.symbolId!) || {
        fileId: prop.fileId,
        path: '', // Would need lookup
        startLine: prop.startLine,
        startCol: prop.startCol,
        endLine: prop.endLine,
        endCol: prop.endCol,
      },
      signature: prop.signature,
    }));
  }

  /**
   * Get the definition location of a symbol
   */
  async definition(symbolId: number): Promise<Location | null> {
    return this.queryEngine.getDefinition(symbolId);
  }

  /**
   * Get all references to a symbol
   */
  async references(symbolId: number): Promise<Location[]> {
    return this.queryEngine.getReferences(symbolId);
  }

  /**
   * Get implementations of an interface/abstract class (placeholder for MVP)
   */
  async implementations(symbolId: number): Promise<Location[]> {
    // Simplified for MVP - would need inheritance tracking
    return [];
  }

  /**
   * Match code snippet (placeholder for MVP)
   */
  async matchSnippet(code: string, langHint?: string): Promise<any[]> {
    // Simplified for MVP - would need AST pattern matching
    return [];
  }

  /**
   * Watch for file changes (placeholder for MVP)
   */
  watch(): void {
    console.log('File watching not implemented in MVP');
  }

  /**
   * Close the index and release resources
   */
  close(): void {
    this.indexer.close();
  }
}

// Re-export types
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
} from './core/types.js';

