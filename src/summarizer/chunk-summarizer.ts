/**
 * Code chunk summarizer - generates AI summaries for code symbols
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import type { SymbolRecord, Language } from '../core/types.js';
import type { CodeDatabase } from '../storage/database.js';

export interface SummaryOptions {
  apiEndpoint: string;
  apiKey: string;
  model?: string;
  concurrency?: number;
  maxRetries?: number;
}

export interface SummaryResult {
  symbolId: number;
  summary: string;
  tokens: number;
  error?: string;
}

export class ChunkSummarizer {
  private options: SummaryOptions;

  constructor(options: SummaryOptions) {
    this.options = {
      model: 'gpt-4o-mini',
      concurrency: 5,
      maxRetries: 3,
      ...options,
    };
  }

  /**
   * Summarize all symbols that need summaries
   */
  async summarizeAll(
    db: CodeDatabase,
    rootDir: string,
    onProgress?: (current: number, total: number, symbol: SymbolRecord) => void
  ): Promise<SummaryResult[]> {
    const symbols = db.getSymbolsNeedingSummary();
    
    if (symbols.length === 0) {
      console.log('No symbols need summarization');
      return [];
    }

    console.log(`Found ${symbols.length} symbols to summarize`);

    const results: SummaryResult[] = [];
    const batches = this.createBatches(symbols, this.options.concurrency!);

    let processed = 0;
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (symbol) => {
          try {
            const result = await this.summarizeSymbol(symbol, db, rootDir);
            processed++;
            if (onProgress) {
              onProgress(processed, symbols.length, symbol);
            }
            return result;
          } catch (error) {
            processed++;
            if (onProgress) {
              onProgress(processed, symbols.length, symbol);
            }
            return {
              symbolId: symbol.symbolId!,
              summary: '',
              tokens: 0,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Summarize a single symbol
   */
  async summarizeSymbol(
    symbol: SymbolRecord,
    db: CodeDatabase,
    rootDir: string
  ): Promise<SummaryResult> {
    // Get file content
    const location = db.getSymbolLocation(symbol.symbolId!);
    if (!location) {
      throw new Error(`Cannot find location for symbol ${symbol.symbolId}`);
    }

    const filePath = `${rootDir}/${location.path}`;
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Extract code chunk
    const startLine = Math.max(0, symbol.startLine - 1);
    const endLine = Math.min(lines.length, symbol.endLine);
    const chunk = lines.slice(startLine, endLine).join('\n');

    // Calculate chunk hash
    const chunkHash = this.calculateChunkHash(chunk);

    // Check if already summarized with same hash
    if (symbol.chunkHash === chunkHash && symbol.chunkSummary) {
      return {
        symbolId: symbol.symbolId!,
        summary: symbol.chunkSummary,
        tokens: symbol.summaryTokens || 0,
      };
    }

    // Generate summary via LLM
    const { summary, tokens } = await this.callLLM(
      symbol,
      chunk,
      location.path
    );

    // Update database
    db.updateSymbolSummary(symbol.symbolId!, {
      chunkHash,
      chunkSummary: summary,
      summaryTokens: tokens,
    });

    return {
      symbolId: symbol.symbolId!,
      summary,
      tokens,
    };
  }

  /**
   * Call LLM API to generate summary
   */
  private async callLLM(
    symbol: SymbolRecord,
    code: string,
    filePath: string
  ): Promise<{ summary: string; tokens: number }> {
    const prompt = this.buildPrompt(symbol, code, filePath);

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.options.maxRetries!; attempt++) {
      try {
        const response = await fetch(this.options.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.options.apiKey}`,
          },
          body: JSON.stringify({
            model: this.options.model,
            messages: [
              {
                role: 'system',
                content: 'You are a code documentation expert. Generate concise, accurate summaries for code symbols.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.3,
            max_tokens: 500,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as any;
        const summary = data.choices?.[0]?.message?.content?.trim() || '';
        const tokens = data.usage?.total_tokens || 0;

        return { summary, tokens };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.options.maxRetries! - 1) {
          await this.sleep(1000 * (attempt + 1)); // Exponential backoff
        }
      }
    }

    throw lastError || new Error('Failed to call LLM');
  }

  /**
   * Build prompt for LLM
   */
  private buildPrompt(symbol: SymbolRecord, code: string, filePath: string): string {
    const kindDesc = this.getKindDescription(symbol.kind);
    
    return `请为以下代码块生成一段简洁的中文说明（2-3句话）：

文件路径: ${filePath}
语言: ${symbol.language}
类型: ${kindDesc}
名称: ${symbol.qualifiedName}
导出: ${symbol.exported ? '是' : '否'}

代码:
\`\`\`${symbol.language}
${code}
\`\`\`

要求:
1. 用中文描述这个${kindDesc}的功能和用途
2. 如果有重要参数或返回值，简要说明
3. 如果有特殊逻辑或注意事项，简要提及
4. 保持在3行以内，不超过150字
5. 不要包含代码，只输出文字说明`;
  }

  private getKindDescription(kind: string): string {
    const map: Record<string, string> = {
      function: '函数',
      method: '方法',
      class: '类',
      interface: '接口',
      struct: '结构体',
      variable: '变量',
      constant: '常量',
      property: '属性',
      field: '字段',
      module: '模块',
      namespace: '命名空间',
      type: '类型',
    };
    return map[kind] || kind;
  }

  /**
   * Calculate hash for code chunk
   */
  private calculateChunkHash(chunk: string): string {
    return createHash('sha256').update(chunk).digest('hex');
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
}

