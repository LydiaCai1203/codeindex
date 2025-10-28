/**
 * Embedding generator - generates vector embeddings for code symbols
 */

import type { SymbolRecord } from '../core/types.js';
import type { CodeDatabase } from '../storage/database.js';

export interface EmbeddingOptions {
  apiEndpoint: string;
  apiKey: string;
  model?: string;
  dimension?: number;
  concurrency?: number;
  maxRetries?: number;
  timeout?: number; // Request timeout in milliseconds, default 30000 (30s)
}

export interface EmbeddingResult {
  symbolId: number;
  embedding: Float32Array;
  tokens: number;
  error?: string;
}

export class EmbeddingsGenerator {
  private options: Required<Omit<EmbeddingOptions, 'dimension'>> & { dimension?: number };

  constructor(options: EmbeddingOptions) {
    // 默认模型配置
    const defaultDimensions: Record<string, number> = {
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-ada-002': 1536,
      'bge-m3': 1024,
      'bge-large-en': 1024,
      'bge-base-en': 768,
    };

    // 如果没有提供 model，使用默认值，但应该从配置中读取
    const model = options.model;
    if (!model) {
      throw new Error('Model is required for EmbeddingsGenerator');
    }
    const dimension = options.dimension || defaultDimensions[model] || 1536;

    this.options = {
      apiEndpoint: options.apiEndpoint,
      apiKey: options.apiKey,
      model,
      dimension,
      concurrency: options.concurrency || 5,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 30000, // 30 seconds default timeout
    };
  }

  /**
   * Generate embeddings for all symbols that need them
   */
  async generateAll(
    db: CodeDatabase,
    rootDir: string,
    onProgress?: (current: number, total: number, symbol: SymbolRecord) => void
  ): Promise<EmbeddingResult[]> {
    const symbols = db.getSymbolsNeedingEmbedding(this.options.model);
    
    if (symbols.length === 0) {
      console.log('No symbols need embedding');
      return [];
    }

    // 静默模式：不输出额外信息，只通过进度条显示

    const results: EmbeddingResult[] = [];
    const batches = this.createBatches(symbols, this.options.concurrency);

    let processed = 0;
    let lastProgressTime = Date.now();
    
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (symbol) => {
          try {
            const result = await this.generateSymbol(symbol, db);
            processed++;
            
            // 更新进度（每 100ms 最多更新一次，避免刷屏）
            const now = Date.now();
            if (onProgress && (now - lastProgressTime > 100 || processed === symbols.length)) {
              onProgress(processed, symbols.length, symbol);
              lastProgressTime = now;
            }
            
            return result;
          } catch (error) {
            processed++;
            
            // 更新进度
            const now = Date.now();
            if (onProgress && (now - lastProgressTime > 100 || processed === symbols.length)) {
              onProgress(processed, symbols.length, symbol);
              lastProgressTime = now;
            }
            
            const errorMsg = error instanceof Error ? error.message : String(error);
            // 静默模式：不输出单个错误，最终统计时会显示失败数量
            
            return {
              symbolId: symbol.symbolId!,
              embedding: new Float32Array(0),
              tokens: 0,
              error: errorMsg,
            };
          }
        })
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Generate embedding for a single symbol
   */
  async generateSymbol(
    symbol: SymbolRecord,
    db: CodeDatabase
  ): Promise<EmbeddingResult> {
    // 获取要嵌入的文本（优先使用 summary，否则使用 qualifiedName）
    const textToEmbed = symbol.chunkSummary || symbol.qualifiedName;
    
    if (!textToEmbed) {
      throw new Error(`No text available for embedding symbol ${symbol.symbolId}`);
    }

    // 生成 embedding
    const { embedding, tokens } = await this.callEmbeddingAPI(textToEmbed);

    // 验证维度（某些模型可能不支持指定维度，使用实际返回的维度）
    const actualDimension = embedding.length;
    if (this.options.dimension && actualDimension !== this.options.dimension) {
      // 如果模型不支持指定维度（如 bge-m3），使用实际维度
      const modelsWithoutDimensions = ['bge-m3', 'bge-large-en', 'bge-base-en'];
      if (!modelsWithoutDimensions.includes(this.options.model.toLowerCase())) {
        console.warn(
          `Dimension mismatch: expected ${this.options.dimension}, got ${actualDimension}. Using actual dimension.`
        );
      }
    }

    // 归一化向量（余弦相似度需要归一化）
    const normalized = this.normalizeVector(embedding);

    // 存储到数据库（使用实际维度）
    if (symbol.symbolId && symbol.chunkHash) {
      db.insertEmbedding({
        symbolId: symbol.symbolId,
        model: this.options.model,
        dim: actualDimension, // 使用实际返回的维度
        embedding: normalized,
        chunkHash: symbol.chunkHash,
      });
    }

    return {
      symbolId: symbol.symbolId!,
      embedding: normalized,
      tokens,
    };
  }

  /**
   * Generate embedding for query text (public method for semantic search)
   */
  async generateQueryEmbedding(text: string): Promise<Float32Array> {
    const { embedding } = await this.callEmbeddingAPI(text);
    return this.normalizeVector(embedding);
  }

  /**
   * Call embedding API
   */
  private async callEmbeddingAPI(text: string): Promise<{ embedding: Float32Array; tokens: number }> {
    let lastError: Error | null = null;
    
    // 确保使用正确的模型
    const modelToUse = this.options.model;
    if (!modelToUse) {
      throw new Error('Model is required but not set in EmbeddingsGenerator');
    }
    
    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      try {
        // 根据端点类型选择请求格式
        // 如果使用 /embeddings 端点，使用 OpenAI 格式
        // 如果使用 /chat/completions 端点，可能需要不同的格式
        const isEmbeddingsEndpoint = this.options.apiEndpoint.includes('/embeddings');
        
        // 某些模型（如 bge-m3）不支持 dimensions 参数
        // 检查模型是否支持 matryoshka（动态维度）
        const modelsWithoutDimensions = ['bge-m3', 'bge-large-en', 'bge-base-en'];
        const supportsDimensions = !modelsWithoutDimensions.includes(modelToUse.toLowerCase());
        
        let requestBody: any;
        if (isEmbeddingsEndpoint) {
          // OpenAI embeddings 格式
          requestBody = {
            model: modelToUse,
            input: text,
          };
          // 只有支持动态维度的模型才添加 dimensions 参数
          if (supportsDimensions && this.options.dimension) {
            requestBody.dimensions = this.options.dimension;
          }
        } else {
          // 尝试兼容 chat/completions 端点（某些服务可能这样实现）
          requestBody = {
            model: modelToUse,
            input: text,
          };
          if (supportsDimensions && this.options.dimension) {
            requestBody.dimensions = this.options.dimension;
          }
        }
        
        // 静默模式：不输出调试信息
        
        // 创建带超时的 fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, this.options.timeout);
        
        try {
          const response = await fetch(this.options.apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.options.apiKey}`,
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
          }

          const data = await response.json() as any;
          
          // 尝试多种响应格式
          let embeddingArray: number[] | undefined;
          let tokens = 0;
          
          // 格式1: OpenAI embeddings 格式 { data: [{ embedding: [...] }], usage: { total_tokens: ... } }
          if (data.data?.[0]?.embedding) {
            embeddingArray = data.data[0].embedding;
            tokens = data.usage?.total_tokens || 0;
          }
          // 格式2: 直接返回 { embedding: [...] }
          else if (data.embedding) {
            embeddingArray = data.embedding;
            tokens = data.tokens || 0;
          }
          // 格式3: 数组格式 [{ embedding: [...] }]
          else if (Array.isArray(data) && data[0]?.embedding) {
            embeddingArray = data[0].embedding;
            tokens = data[0].tokens || 0;
          }
          // 格式4: chat completions 可能的格式（需要检查实际响应）
          else if (data.choices?.[0]?.message?.content) {
            // 如果返回的是文本，可能需要解析
            throw new Error('API returned text instead of embedding. Please check API endpoint format.');
          }

          if (!embeddingArray || !Array.isArray(embeddingArray)) {
            throw new Error('Invalid embedding response format. Expected array of numbers.');
          }

          // 转换为 Float32Array
          const embedding = new Float32Array(embeddingArray);

          return { embedding, tokens };
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            throw new Error(`Request timeout after ${this.options.timeout}ms`);
          }
          throw fetchError;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.options.maxRetries - 1) {
          const delay = 1000 * (attempt + 1); // Exponential backoff
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Failed to call embedding API');
  }

  /**
   * Normalize vector to unit length (for cosine similarity)
   */
  private normalizeVector(vec: Float32Array): Float32Array {
    const magnitude = Math.sqrt(
      Array.from(vec).reduce((sum, val) => sum + val * val, 0)
    );
    
    if (magnitude === 0) {
      return vec;
    }
    
    return new Float32Array(vec.map(v => v / magnitude));
  }

  /**
   * Create batches for concurrent processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the model name
   */
  getModel(): string {
    return this.options.model;
  }

  /**
   * Get the dimension
   */
  getDimension(): number {
    return this.options.dimension!;
  }
}

