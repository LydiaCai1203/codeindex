/**
 * Main API entry point for CodeIndex
 */

import { Indexer } from './indexer/indexer.js';
import { QueryEngine } from './query/query-engine.js';
import { EmbeddingsGenerator } from './embeddings/embeddings-generator.js';
import { FileWatcher } from './watcher/file-watcher.js';
import type { EmbeddingOptions } from './embeddings/embeddings-generator.js';
import type {
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

export class CodeIndex {
  private indexer: Indexer;
  private queryEngine: QueryEngine;
  private initialized = false;
  private db: ReturnType<typeof this.indexer.getDatabase>;
  private embeddingGenerator?: EmbeddingsGenerator;
  private watcher?: FileWatcher;

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
   * Watch for file changes and automatically update index
   */
  watch(): void {
    if (!this.initialized) {
      throw new Error('CodeIndex not initialized');
    }

    if (this.watcher) {
      console.log('[Watcher] Already watching files');
      return;
    }

    // 从配置读取批量索引参数，如果没有则使用默认值
    // 注意：这些值会在 CLI 中从配置文件读取并传递过来
    const batchIntervalMs = this.options.batchIntervalMinutes 
      ? this.options.batchIntervalMinutes * 60 * 1000 
      : 10 * 60 * 1000; // 默认 10 分钟（如果配置文件没有设置）
    const minChangeLines = this.options.minChangeLines ?? 5; // 默认 5 行（如果配置文件没有设置）

    this.watcher = new FileWatcher(this.indexer, this.db, {
      rootDir: this.options.rootDir,
      include: this.options.include,
      exclude: this.options.exclude,
      debounceMs: 500,
      batchIntervalMs,
      minChangeLines,
      onFileChange: (path, event) => {
        // 事件已在 FileWatcher 中输出，这里可以添加额外的回调逻辑
      },
      onError: (error) => {
        console.error('[Watcher] ❌ Error:', error.message);
      },
    });

    this.watcher.start();

    // 处理退出信号
    const cleanup = () => {
      console.log('\n[Watcher] Stopping file watcher...');
      this.watcher?.stop();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  /**
   * Stop watching files
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.stop();
      this.watcher = undefined;
    }
  }

  /**
   * Generate embeddings for all symbols that have summaries
   */
  async generateEmbeddings(
    options: EmbeddingOptions,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('CodeIndex not initialized');
    }

    this.embeddingGenerator = new EmbeddingsGenerator(options);
    
    const results = await this.embeddingGenerator.generateAll(
      this.db,
      this.options.rootDir,
      (current, total, symbol) => {
        if (onProgress) {
          onProgress(current, total);
        }
      }
    );

    const successful = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;
    
    if (!onProgress) {
      console.log(`Embedding complete: ${successful} successful, ${failed} failed`);
    }
  }

  /**
   * Semantic search for symbols
   */
  async semanticSearch(options: {
    query: string;
    model?: string;
    topK?: number;
    language?: Language;
    kind?: SymbolKind;
    minSimilarity?: number;
    embeddingOptions?: EmbeddingOptions;
  }): Promise<Array<{
    symbol: SymbolRecord;
    similarity: number;
    location: Location;
  }>> {
    if (!this.initialized) {
      throw new Error('CodeIndex not initialized');
    }

    // 如果没有 embeddingGenerator，根据 options 创建
    if (!this.embeddingGenerator && options.embeddingOptions) {
      this.embeddingGenerator = new EmbeddingsGenerator(options.embeddingOptions);
    }

    if (!this.embeddingGenerator) {
      throw new Error('EmbeddingGenerator not initialized. Provide embeddingOptions or call generateEmbeddings first.');
    }

    return this.queryEngine.semanticSearch({
      query: options.query,
      model: options.model || this.embeddingGenerator?.getModel() || 'text-embedding-3-small',
      topK: options.topK || 10,
      language: options.language,
      kind: options.kind,
      minSimilarity: options.minSimilarity || 0.7,
      embeddingGenerator: this.embeddingGenerator,
    });
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

