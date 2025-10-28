/**
 * Code indexer - scans files, parses, and stores symbols/calls
 */

import { readFileSync, statSync } from 'fs';
import { createHash } from 'crypto';
import fg from 'fast-glob';
import { CodeDatabase } from '../storage/database.js';
import { TreeSitterParser } from '../parser/tree-sitter-wrapper.js';
import { TypeScriptExtractor } from '../extractor/typescript-extractor.js';
import { GoExtractor } from '../extractor/go-extractor.js';
import { PythonExtractor } from '../extractor/python-extractor.js';
import { RustExtractor } from '../extractor/rust-extractor.js';
import { JavaExtractor } from '../extractor/java-extractor.js';
import { HtmlExtractor } from '../extractor/html-extractor.js';
import type { IndexOptions, Language } from '../core/types.js';

export class Indexer {
  private db: CodeDatabase;
  private parser: TreeSitterParser;
  private tsExtractor: TypeScriptExtractor;
  private goExtractor: GoExtractor;
  private pythonExtractor: PythonExtractor;
  private rustExtractor: RustExtractor;
  private javaExtractor: JavaExtractor;
  private htmlExtractor: HtmlExtractor;
  private options: IndexOptions;

  constructor(options: IndexOptions) {
    this.options = options;
    this.db = new CodeDatabase(options.dbPath);
    this.parser = new TreeSitterParser();
    this.tsExtractor = new TypeScriptExtractor();
    this.goExtractor = new GoExtractor(options.maxNestedStructDepth);
    this.pythonExtractor = new PythonExtractor();
    this.rustExtractor = new RustExtractor();
    this.javaExtractor = new JavaExtractor();
    this.htmlExtractor = new HtmlExtractor();
  }

  async init(): Promise<void> {
    await this.parser.init(this.options.languages);
  }

  async indexAll(onProgress?: (current: number, total: number) => void): Promise<void> {
    const files = await this.scanFiles();
    
    if (!onProgress) {
      console.log(`Found ${files.length} files to index`);
    }

    let indexed = 0;
    for (const filePath of files) {
      try {
        await this.indexFile(filePath);
        indexed++;
        if (onProgress) {
          onProgress(indexed, files.length);
        } else if (indexed % 10 === 0) {
          console.log(`Indexed ${indexed}/${files.length} files`);
        }
      } catch (error) {
        console.error(`Error indexing ${filePath}:`, error);
      }
    }

    if (!onProgress) {
      console.log(`Indexing complete: ${indexed} files indexed`);
    }
  }

  async indexFile(filePath: string): Promise<void> {
    // Normalize path relative to root
    const relativePath = filePath.startsWith(this.options.rootDir)
      ? filePath.slice(this.options.rootDir.length + 1)
      : filePath;

    // Get language
    const language = this.parser.getLanguageForFile(relativePath);
    if (!language || !this.options.languages.includes(language)) {
      return;
    }

    // Read file
    const content = readFileSync(filePath, 'utf-8');
    const stats = statSync(filePath);
    const contentHash = this.hashContent(content);

    // Check if file needs reindexing
    const existingFile = this.db.getFileByPath(relativePath);
    if (existingFile && existingFile.contentHash === contentHash) {
      // File hasn't changed, skip
      return;
    }

    // Delete old data if exists
    if (existingFile) {
      this.db.deleteSymbolsByFile(existingFile.fileId!);
      this.db.deleteCallsByFile(existingFile.fileId!);
      this.db.deleteReferencesByFile(existingFile.fileId!);
    }

    // Insert/update file record
    const fileId = this.db.insertFile({
      path: relativePath,
      language,
      contentHash,
      mtime: stats.mtimeMs,
      size: stats.size,
    });

    // Parse AST
    const parseResult = this.parser.parse(content, language);

    // Extract symbols and calls using appropriate extractor
    let extraction;
    if (language === 'go') {
      extraction = this.goExtractor.extract(parseResult.tree, content, language);
    } else if (language === 'python') {
      extraction = this.pythonExtractor.extract(parseResult.tree, content, language);
    } else if (language === 'rust') {
      extraction = this.rustExtractor.extract(parseResult.tree, content, language);
    } else if (language === 'java') {
      extraction = this.javaExtractor.extract(parseResult.tree, content, language);
    } else if (language === 'html') {
      extraction = this.htmlExtractor.extract(parseResult.tree, content, language);
    } else {
      extraction = this.tsExtractor.extract(parseResult.tree, content, language);
    }

    // Store symbols
    const symbolMap = new Map<string, number>(); // qualifiedName -> symbolId
    
    this.db.transaction(() => {
      for (const symbol of extraction.symbols) {
        const symbolId = this.db.insertSymbol({
          ...symbol,
          fileId,
        });
        symbolMap.set(symbol.qualifiedName, symbolId);
      }

      // Store calls (best effort matching)
      for (const call of extraction.calls) {
        // Try to find caller and callee symbols
        const calleeSymbols = this.db.findSymbolsByName(call.calleeName);
        
        if (calleeSymbols.length > 0) {
          // Find the most likely caller by location
          const callerSymbol = this.findContainingSymbol(
            extraction.symbols,
            call.siteStartLine
          );

          if (callerSymbol) {
            const callerSymbolId = symbolMap.get(callerSymbol.qualifiedName);
            const calleeSymbolId = calleeSymbols[0].symbolId; // Use first match

            if (callerSymbolId && calleeSymbolId) {
              this.db.insertCall({
                callerSymbolId,
                calleeSymbolId,
                siteFileId: fileId,
                siteStartLine: call.siteStartLine,
                siteStartCol: call.siteStartCol,
                siteEndLine: call.siteEndLine,
                siteEndCol: call.siteEndCol,
              });
            }
          }
        }
      }

      // Store references
      for (const ref of extraction.references) {
        const targetSymbols = this.db.findSymbolsByName(ref.name);
        
        if (targetSymbols.length > 0) {
          this.db.insertReference({
            fromFileId: fileId,
            fromStartLine: ref.startLine,
            fromStartCol: ref.startCol,
            fromEndLine: ref.endLine,
            fromEndCol: ref.endCol,
            toSymbolId: targetSymbols[0].symbolId!,
            refKind: ref.refKind,
          });
        }
      }
    });
  }

  private findContainingSymbol(
    symbols: Array<{ qualifiedName: string; startLine: number; endLine: number }>,
    line: number
  ): { qualifiedName: string } | null {
    // Find the innermost symbol containing this line
    let bestMatch: { qualifiedName: string } | null = null;
    let smallestRange = Infinity;

    for (const symbol of symbols) {
      if (line >= symbol.startLine && line <= symbol.endLine) {
        const range = symbol.endLine - symbol.startLine;
        if (range < smallestRange) {
          smallestRange = range;
          bestMatch = { qualifiedName: symbol.qualifiedName };
        }
      }
    }

    return bestMatch;
  }

  private async scanFiles(): Promise<string[]> {
    const patterns = this.options.include || ['**/*'];
    const ignore = this.options.exclude || [];

    const files = await fg(patterns, {
      cwd: this.options.rootDir,
      absolute: true,
      ignore,
      onlyFiles: true,
    });

    return files;
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  close(): void {
    this.db.close();
  }

  getDatabase(): CodeDatabase {
    return this.db;
  }
}

