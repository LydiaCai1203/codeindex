#!/usr/bin/env node

/**
 * CLI for CodeIndex
 */

import { Command } from 'commander';
import { CodeIndex } from '../index.js';
import type { Language, SymbolKind } from '../core/types.js';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const program = new Command();

// Simple progress bar helper
function createProgressBar(total: number, label: string = 'Progress') {
  let current = 0;
  const barLength = 40;
  
  const render = () => {
    const percent = Math.floor((current / total) * 100);
    const filled = Math.floor((current / total) * barLength);
    const empty = barLength - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    process.stdout.write(`\r${label}: [${bar}] ${percent}% (${current}/${total})`);
  };
  
  return {
    increment: () => {
      current++;
      render();
      if (current >= total) {
        process.stdout.write('\n');
      }
    },
    update: (value: number) => {
      current = value;
      render();
      if (current >= total) {
        process.stdout.write('\n');
      }
    },
    finish: () => {
      current = total;
      render();
      process.stdout.write('\n');
    }
  };
}

program
  .name('codeindex')
  .description('Code indexing tool based on tree-sitter AST')
  .version('0.1.0');

// Init command
program
  .command('init')
  .description('Initialize a new code index configuration')
  .action(() => {
    const configPath = join(process.cwd(), 'codeindex.config.json');
    
    if (existsSync(configPath)) {
      console.error('Configuration file already exists');
      process.exit(1);
    }

    const config = {
      rootDir: '.',
      dbPath: '.codeindex/sqlite.db',
      languages: ['ts', 'js'],
      include: ['src/**/*', 'lib/**/*'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
      concurrency: 4,
      summarizer: {
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gpt-4o-mini',
        concurrency: 5,
        maxRetries: 3,
      },
      watcher: {
        batchIntervalMinutes: 10,
        minChangeLines: 5,
        debounceMs: 500,
      },
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Created codeindex.config.json');
  });

// Index command
program
  .command('index')
  .description('Build or rebuild the code index')
  .option('--config <path>', 'Config file path', 'codeindex.config.json')
  .option('--root <dir>', 'Root directory to index')
  .option('--db <path>', 'Database path')
  .option('--lang <languages...>', 'Languages to index')
  .option('--include <patterns...>', 'Include patterns')
  .option('--exclude <patterns...>', 'Exclude patterns')
  .option('--max-nested-depth <n>', 'Maximum depth for nested struct indexing')
  .action(async (options) => {
    try {
      const startTime = Date.now();
      console.log('Starting indexing...');
      
      // Load config file if present
      const configPath = join(process.cwd(), options.config || 'codeindex.config.json');
      const loadedConfig = existsSync(configPath)
        ? JSON.parse(readFileSync(configPath, 'utf-8'))
        : {};

      const rootDir = options.root || loadedConfig.rootDir || '.';
      const dbPath = options.db || loadedConfig.dbPath || '.codeindex/sqlite.db';
      const languages = options.lang || loadedConfig.languages || ['ts', 'js'];
      const include = options.include || loadedConfig.include || ['**/*'];
      const exclude = options.exclude || loadedConfig.exclude || ['**/node_modules/**', '**/dist/**', '**/.git/**'];
      const maxNestedDepth = options.maxNestedDepth ? parseInt(options.maxNestedDepth) : (loadedConfig.maxNestedStructDepth || 3);
      
      const index = await CodeIndex.create({
        rootDir,
        dbPath,
        languages: languages as Language[],
        include,
        exclude,
        maxNestedStructDepth: maxNestedDepth,
      });

      let progressBar: ReturnType<typeof createProgressBar> | null = null;
      let hasStarted = false;
      
      await index.reindexAll((current, total) => {
        if (!progressBar && total > 0) {
          if (!hasStarted) {
            console.log(`Found ${total} files to index`);
            hasStarted = true;
          }
          progressBar = createProgressBar(total, 'Indexing');
        }
        if (progressBar) {
          progressBar.update(current);
        }
      });
      
      if (!hasStarted) {
        console.log('No files to index');
      }
      
      index.close();

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✓ Indexing complete! (${elapsed}s)`);
    } catch (error) {
      console.error('Error during indexing:', error);
      process.exit(1);
    }
  });

// Rebuild command
program
  .command('rebuild')
  .description('Clear and rebuild the entire code index from scratch')
  .option('--config <path>', 'Config file path', 'codeindex.config.json')
  .option('--root <dir>', 'Root directory to index')
  .option('--db <path>', 'Database path')
  .option('--lang <languages...>', 'Languages to index')
  .option('--include <patterns...>', 'Include patterns')
  .option('--exclude <patterns...>', 'Exclude patterns')
  .option('--max-nested-depth <n>', 'Maximum depth for nested struct indexing')
  .action(async (options) => {
    try {
      const startTime = Date.now();
      console.log('Starting rebuild...');
      
      // Load config file if present
      const configPath = join(process.cwd(), options.config || 'codeindex.config.json');
      const loadedConfig = existsSync(configPath)
        ? JSON.parse(readFileSync(configPath, 'utf-8'))
        : {};

      const rootDir = options.root || loadedConfig.rootDir || '.';
      const dbPath = options.db || loadedConfig.dbPath || '.codeindex/sqlite.db';
      const languages = options.lang || loadedConfig.languages || ['ts', 'js'];
      const include = options.include || loadedConfig.include || ['**/*'];
      const exclude = options.exclude || loadedConfig.exclude || ['**/node_modules/**', '**/dist/**', '**/.git/**'];
      const maxNestedDepth = options.maxNestedDepth ? parseInt(options.maxNestedDepth) : (loadedConfig.maxNestedStructDepth || 3);
      
      const index = await CodeIndex.create({
        rootDir,
        dbPath,
        languages: languages as Language[],
        include,
        exclude,
        maxNestedStructDepth: maxNestedDepth,
      });

      console.log('Clearing existing index...');
      let progressBar: ReturnType<typeof createProgressBar> | null = null;
      let hasStarted = false;
      
      await index.rebuild((current, total) => {
        if (!progressBar && total > 0) {
          if (!hasStarted) {
            console.log(`Found ${total} files to rebuild`);
            hasStarted = true;
          }
          progressBar = createProgressBar(total, 'Rebuilding');
        }
        if (progressBar) {
          progressBar.update(current);
        }
      });
      
      if (!hasStarted) {
        console.log('No files to rebuild');
      }
      
      index.close();

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✓ Rebuild complete! (${elapsed}s)`);
    } catch (error) {
      console.error('Error during rebuild:', error);
      process.exit(1);
    }
  });

// Watch command
program
  .command('watch')
  .description('Watch for file changes and automatically update the index')
  .option('--config <path>', 'Config file path', 'codeindex.config.json')
  .option('--root <dir>', 'Root directory to watch')
  .option('--db <path>', 'Database path')
  .option('--lang <languages...>', 'Languages to index')
  .option('--include <patterns...>', 'Include patterns')
  .option('--exclude <patterns...>', 'Exclude patterns')
  .option('--max-nested-depth <n>', 'Maximum depth for nested struct indexing')
  .option('--debounce <ms>', 'Debounce delay in milliseconds', '500')
  .option('--batch-interval <minutes>', 'Batch index interval in minutes', '10')
  .option('--min-change-lines <n>', 'Minimum lines changed to trigger indexing', '5')
  .action(async (options) => {
    try {
      console.log('Starting file watcher...');
      
      // Load config file if present
      const configPath = join(process.cwd(), options.config || 'codeindex.config.json');
      const loadedConfig = existsSync(configPath)
        ? JSON.parse(readFileSync(configPath, 'utf-8'))
        : {};

      const rootDir = options.root || loadedConfig.rootDir || '.';
      const dbPath = options.db || loadedConfig.dbPath || '.codeindex/sqlite.db';
      const languages = options.lang || loadedConfig.languages || ['ts', 'js'];
      const include = options.include || loadedConfig.include || ['**/*'];
      const exclude = options.exclude || loadedConfig.exclude || ['**/node_modules/**', '**/dist/**', '**/.git/**'];
      const maxNestedDepth = options.maxNestedDepth ? parseInt(options.maxNestedDepth) : (loadedConfig.maxNestedStructDepth || 3);
      
      // 从配置文件读取 watcher 配置，CLI 参数优先
      const watcherConfig = loadedConfig.watcher || {};
      const debounceMs = options.debounce ? parseInt(options.debounce) : (watcherConfig.debounceMs || 500);
      const batchIntervalMinutes = options.batchInterval ? parseInt(options.batchInterval) : (watcherConfig.batchIntervalMinutes || 10);
      const minChangeLines = options.minChangeLines ? parseInt(options.minChangeLines) : (watcherConfig.minChangeLines || 5);
      
      const index = await CodeIndex.create({
        rootDir,
        dbPath,
        languages: languages as Language[],
        include,
        exclude,
        maxNestedStructDepth: maxNestedDepth,
        batchIntervalMinutes, // 传递批量索引间隔
        minChangeLines, // 传递最小变更行数
      });

      // 启动监听
      index.watch();

      console.log('File watcher is running. Press Ctrl+C to stop.');
      console.log(`Watching: ${rootDir}`);
      console.log(`Languages: ${languages.join(', ')}`);
      console.log(`Exclude patterns: ${exclude.join(', ')}`);
      console.log(`Batch interval: ${batchIntervalMinutes} minutes`);
      console.log(`Min change lines: ${minChangeLines}`);
      
      // 保持进程运行
      // 注意：不要调用 index.close()，因为 watch 需要在后台运行
    } catch (error) {
      console.error('Error starting file watcher:', error);
      process.exit(1);
    }
  });

// Symbol command
program
  .command('symbol <name>')
  .description('Find a symbol by name')
  .option('--config <path>', 'Config file path', 'codeindex.config.json')
  .option('--lang <language>', 'Filter by language')
  .option('--kind <kind>', 'Filter by symbol kind (function, class, etc.)')
  .option('--json', 'Output as JSON')
  .option('--db <path>', 'Database path')
  .action(async (name, options) => {
    try {
      // Load config file if present
      const configPath = join(process.cwd(), options.config || 'codeindex.config.json');
      const loadedConfig = existsSync(configPath)
        ? JSON.parse(readFileSync(configPath, 'utf-8'))
        : {};

      const dbPath = options.db || loadedConfig.dbPath || '.codeindex/sqlite.db';
      const rootDir = loadedConfig.rootDir || '.';
      const languages = loadedConfig.languages || ['ts', 'js'];

      const index = await CodeIndex.create({
        rootDir,
        dbPath,
        languages: languages as Language[],
      });

      const symbols = await index.findSymbols({
        name,
        language: options.lang,
        kind: options.kind,
      });

      if (options.json) {
        console.log(JSON.stringify(symbols, null, 2));
      } else {
        if (symbols.length === 0) {
          console.log(`No symbols found for "${name}"`);
        } else {
          console.log(`Found ${symbols.length} symbol(s):\n`);
          for (const sym of symbols) {
            console.log(`  ${sym.kind} ${sym.qualifiedName}`);
            console.log(`    Location: Line ${sym.startLine}-${sym.endLine}`);
            console.log(`    File ID: ${sym.fileId}`);
            if (sym.signature) {
              console.log(`    Signature: ${sym.signature.slice(0, 60)}...`);
            }
            console.log();
          }
        }
      }

      index.close();
    } catch (error) {
      console.error('Error finding symbol:', error);
      process.exit(1);
    }
  });

// Call chain command
program
  .command('call-chain')
  .description('Generate a call chain for a symbol')
  .option('--config <path>', 'Config file path', 'codeindex.config.json')
  .requiredOption('--from <symbolId>', 'Starting symbol ID')
  .option('--direction <dir>', 'Direction: forward or backward', 'forward')
  .option('--depth <n>', 'Maximum depth', '5')
  .option('--pretty', 'Pretty print the call chain')
  .option('--json', 'Output as JSON')
  .option('--db <path>', 'Database path')
  .action(async (options) => {
    try {
      // Load config file if present
      const configPath = join(process.cwd(), options.config || 'codeindex.config.json');
      const loadedConfig = existsSync(configPath)
        ? JSON.parse(readFileSync(configPath, 'utf-8'))
        : {};

      const dbPath = options.db || loadedConfig.dbPath || '.codeindex/sqlite.db';
      const rootDir = loadedConfig.rootDir || '.';
      const languages = loadedConfig.languages || ['ts', 'js'];

      const index = await CodeIndex.create({
        rootDir,
        dbPath,
        languages: languages as Language[],
      });

      const chain = await index.callChain({
        from: parseInt(options.from),
        direction: options.direction,
        depth: parseInt(options.depth),
      });

      if (!chain) {
        console.log('No call chain found');
        index.close();
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(chain, null, 2));
      } else if (options.pretty) {
        printCallChain(chain, 0);
      } else {
        console.log(JSON.stringify(chain, null, 2));
      }

      index.close();
    } catch (error) {
      console.error('Error generating call chain:', error);
      process.exit(1);
    }
  });

// Summarize command
program
  .command('summarize')
  .description('Generate AI summaries for code symbols')
  .option('--root <dir>', 'Root directory', '.')
  .option('--db <path>', 'Database path', '.codeindex/sqlite.db')
  .option('--config <path>', 'Config file path', 'codeindex.config.json')
  .option('--api-endpoint <url>', 'LLM API endpoint')
  .option('--api-key <key>', 'LLM API key')
  .option('--model <model>', 'Model name')
  .option('--concurrency <n>', 'Concurrent requests')
  .action(async (options) => {
    try {
      const startTime = Date.now();
      console.log('Starting summarization...');
      
      const { ChunkSummarizer } = await import('../summarizer/chunk-summarizer.js');
      const { CodeDatabase } = await import('../storage/database.js');
      
      // Load config file if present
      const configPath = join(process.cwd(), options.config || 'codeindex.config.json');
      const loadedConfig = existsSync(configPath)
        ? JSON.parse(readFileSync(configPath, 'utf-8'))
        : {};
      const summarizerConfig = (loadedConfig && loadedConfig.summarizer) ? loadedConfig.summarizer : {};

      const apiEndpoint = options.apiEndpoint || summarizerConfig.apiEndpoint;
      const apiKey = options.apiKey || summarizerConfig.apiKey || process.env.OPENAI_API_KEY;
      const model = options.model || summarizerConfig.model;
      const cliConcurrency = options.concurrency ? parseInt(options.concurrency) : undefined;
      const configuredConcurrency = summarizerConfig.concurrency;
      const maxRetries = summarizerConfig.maxRetries;

      if (!apiEndpoint || !apiKey) {
        console.error('Missing LLM configuration. Please set apiEndpoint/apiKey via config file or CLI flags.');
        console.error('You can run "codeindex init" to create a config and then fill summarizer.apiEndpoint/apiKey, or pass --api-endpoint/--api-key.');
        process.exit(1);
      }

      // Resolve root/db: use config values if CLI flags are at defaults
      const resolvedRoot = (options.root === '.' && loadedConfig.rootDir) ? loadedConfig.rootDir : options.root;
      const resolvedDb = (options.db === '.codeindex/sqlite.db' && loadedConfig.dbPath) ? loadedConfig.dbPath : options.db;

      const db = new CodeDatabase(resolvedDb);
      const summarizer = new ChunkSummarizer({
        apiEndpoint,
        apiKey,
        ...(model ? { model } : {}),
        ...(cliConcurrency ? { concurrency: cliConcurrency } : (configuredConcurrency ? { concurrency: configuredConcurrency } : {})),
        ...(typeof maxRetries === 'number' ? { maxRetries } : {}),
      });

      // Get total count first
      const symbolsToSummarize = db.getSymbolsNeedingSummary();
      if (symbolsToSummarize.length === 0) {
        console.log('✓ No symbols need summarization');
        db.close();
        return;
      }

      const progressBar = createProgressBar(symbolsToSummarize.length, 'Summarizing');
      
      const results = await summarizer.summarizeAll(
        db,
        resolvedRoot,
        (current, total, symbol) => {
          progressBar.update(current);
        }
      );

      const successful = results.filter((r) => !r.error).length;
      const failed = results.filter((r) => r.error).length;
      const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✓ Summarization complete! (${elapsed}s)`);
      console.log(`  Successful: ${successful}`);
      console.log(`  Failed: ${failed}`);
      console.log(`  Total tokens: ${totalTokens}`);

      if (failed > 0) {
        console.log('\nFailed symbols:');
        results
          .filter((r) => r.error)
          .forEach((r) => {
            console.log(`  Symbol ${r.symbolId}: ${r.error}`);
          });
      }

      db.close();
    } catch (error) {
      console.error('Error during summarization:', error);
      process.exit(1);
    }
  });

// Properties command
program
  .command('properties <objectName>')
  .description('Get properties and methods of an object/class/struct')
  .option('--config <path>', 'Config file path', 'codeindex.config.json')
  .option('--lang <language>', 'Programming language filter (ts, js, go, python)')
  .option('--json', 'Output as JSON')
  .option('--db <path>', 'Database path')
  .action(async (objectName, options) => {
    try {
      // Load config file if present
      const configPath = join(process.cwd(), options.config || 'codeindex.config.json');
      const loadedConfig = existsSync(configPath)
        ? JSON.parse(readFileSync(configPath, 'utf-8'))
        : {};

      const dbPath = options.db || loadedConfig.dbPath || '.codeindex/sqlite.db';
      const rootDir = loadedConfig.rootDir || '.';
      const languages = loadedConfig.languages || ['ts', 'js', 'go', 'python'];

      const index = await CodeIndex.create({
        rootDir,
        dbPath,
        languages: languages as Language[],
      });

      const properties = await index.objectProperties({ 
        object: objectName,
        language: options.lang,
      });

      if (options.json) {
        console.log(JSON.stringify(properties, null, 2));
      } else {
        if (properties.length === 0) {
          console.log(`No properties found for "${objectName}"`);
        } else {
          console.log(`Properties of ${objectName}:\n`);
          
          // 获取所有属性的 qualifiedName，并按层级排序
          const propsWithQualified = properties.map(prop => {
            const db = (index as any).indexer.getDatabase();
            const symbols = db.getAllSymbols();
            const fullSymbol = symbols.find((s: any) => 
              s.name === prop.name && 
              s.startLine === prop.location.startLine &&
              s.qualifiedName.includes(objectName)
            );
            return {
              ...prop,
              qualifiedName: fullSymbol?.qualifiedName || `${objectName}.${prop.name}`,
              depth: fullSymbol ? (fullSymbol.qualifiedName.match(/\./g) || []).length : 1
            };
          });
          
          // 按 qualifiedName 排序以保持层级顺序
          propsWithQualified.sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName));
          
          for (const prop of propsWithQualified) {
            // 计算缩进
            const indent = '  '.repeat(prop.depth);
            const displayName = prop.qualifiedName.split('.').slice(-1)[0];
            const fullPath = prop.qualifiedName.split('.').slice(1).join('.');
            
            console.log(`${indent}${prop.kind} ${displayName}`);
            console.log(`${indent}  Path: ${fullPath}`);
            if (prop.location) {
              console.log(`${indent}  Location: ${prop.location.path}:${prop.location.startLine}`);
            }
            if (prop.signature) {
              console.log(`${indent}  Signature: ${prop.signature}`);
            }
            console.log();
          }
        }
      }

      index.close();
    } catch (error) {
      console.error('Error getting properties:', error);
      process.exit(1);
    }
  });

// Embed command
program
  .command('embed')
  .description('Generate embeddings for code symbols')
  .option('--root <dir>', 'Root directory', '.')
  .option('--db <path>', 'Database path', '.codeindex/sqlite.db')
  .option('--config <path>', 'Config file path', 'codeindex.config.json')
  .option('--api-endpoint <url>', 'Embedding API endpoint')
  .option('--api-key <key>', 'Embedding API key')
  .option('--model <model>', 'Embedding model name')
  .option('--dimension <dim>', 'Vector dimension')
  .option('--concurrency <n>', 'Concurrent requests')
  .option('--test-query <text>', 'Test semantic search with query text')
  .option('--top-k <k>', 'Top-K results for test query', '10')
  .action(async (options) => {
    try {
      const startTime = Date.now();
      console.log('Starting embedding generation...');
      
      const { EmbeddingsGenerator } = await import('../embeddings/embeddings-generator.js');
      const { CodeDatabase } = await import('../storage/database.js');
      const { CodeIndex } = await import('../index.js');
      
      // Load config file if present
      const configPath = join(process.cwd(), options.config || 'codeindex.config.json');
      const loadedConfig = existsSync(configPath)
        ? JSON.parse(readFileSync(configPath, 'utf-8'))
        : {};
      const embeddingConfig = (loadedConfig && loadedConfig.embedding) ? loadedConfig.embedding : {};

      const apiEndpoint = options.apiEndpoint || embeddingConfig.apiEndpoint;
      const apiKey = options.apiKey || embeddingConfig.apiKey || process.env.OPENAI_API_KEY;
      const model = options.model || embeddingConfig.model;
      const dimension = options.dimension ? parseInt(options.dimension) : embeddingConfig.dimension;
      const cliConcurrency = options.concurrency ? parseInt(options.concurrency) : undefined;
      const configuredConcurrency = embeddingConfig.concurrency;
      const maxRetries = embeddingConfig.maxRetries;

      if (!apiEndpoint || !apiKey) {
        console.error('Missing embedding configuration. Please set apiEndpoint/apiKey via config file or CLI flags.');
        console.error('You can run "codeindex init" to create a config and then fill embedding.apiEndpoint/apiKey, or pass --api-endpoint/--api-key.');
        process.exit(1);
      }

      if (!model) {
        console.error('Missing embedding model. Please set model via config file or --model flag.');
        process.exit(1);
      }

      // Resolve root/db
      const resolvedRoot = (options.root === '.' && loadedConfig.rootDir) ? loadedConfig.rootDir : options.root;
      const resolvedDb = (options.db === '.codeindex/sqlite.db' && loadedConfig.dbPath) ? loadedConfig.dbPath : options.db;
      const languages = loadedConfig.languages || ['ts', 'js'];

      const index = await CodeIndex.create({
        rootDir: resolvedRoot,
        dbPath: resolvedDb,
        languages: languages as Language[],
      });

      // Generate embeddings
      const generator = new EmbeddingsGenerator({
        apiEndpoint,
        apiKey,
        ...(model ? { model } : {}),
        ...(dimension ? { dimension } : {}),
        ...(cliConcurrency ? { concurrency: cliConcurrency } : (configuredConcurrency ? { concurrency: configuredConcurrency } : {})),
        ...(typeof maxRetries === 'number' ? { maxRetries } : {}),
      });

      const db = (index as any).indexer.getDatabase();
      const symbolsToEmbed = db.getSymbolsNeedingEmbedding(model);
      if (symbolsToEmbed.length === 0) {
        console.log('✓ No symbols need embedding');
        
        // If test query provided, still try semantic search
        if (options.testQuery) {
          console.log(`\n🔍 Testing semantic search with query: "${options.testQuery}"`);
          const topK = parseInt(options.topK || '10');
          
          (index as any).embeddingGenerator = generator;
          const searchResults = await index.semanticSearch({
            query: options.testQuery,
            model,
            topK,
            embeddingOptions: {
              apiEndpoint,
              apiKey,
              model,
              ...(dimension ? { dimension } : {}),
            },
          });

          if (searchResults.length === 0) {
            console.log('  No results found');
          } else {
            console.log(`\n  Found ${searchResults.length} result(s):\n`);
            searchResults.forEach((result, idx) => {
              console.log(`  ${idx + 1}. ${result.symbol.kind} ${result.symbol.qualifiedName} (similarity: ${(result.similarity * 100).toFixed(1)}%)`);
              console.log(`     Location: ${result.location.path}:${result.location.startLine}`);
              if (result.symbol.chunkSummary) {
                console.log(`     Summary: ${result.symbol.chunkSummary.slice(0, 80)}...`);
              }
              console.log();
            });
          }
        }
        
        index.close();
        return;
      }

      const progressBar = createProgressBar(symbolsToEmbed.length, 'Generating embeddings');
      
      const results = await generator.generateAll(
        db,
        resolvedRoot,
        (current, total) => {
          progressBar.update(current);
        }
      );

      const successful = results.filter((r) => !r.error).length;
      const failed = results.filter((r) => r.error).length;
      const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✓ Embedding generation complete! (${elapsed}s)`);
      console.log(`  Successful: ${successful}`);
      console.log(`  Failed: ${failed}`);
      console.log(`  Total tokens: ${totalTokens}`);

      if (failed > 0) {
        console.log('\nFailed symbols:');
        results
          .filter((r) => r.error)
          .forEach((r) => {
            console.log(`  Symbol ${r.symbolId}: ${r.error}`);
          });
      }

      // Test semantic search if query provided
      if (options.testQuery) {
        console.log(`\n🔍 Testing semantic search with query: "${options.testQuery}"`);
        const topK = parseInt(options.topK || '10');
        
        (index as any).embeddingGenerator = generator;
        const searchResults = await index.semanticSearch({
          query: options.testQuery,
          model,
          topK,
        });

        if (searchResults.length === 0) {
          console.log('  No results found');
        } else {
          console.log(`\n  Found ${searchResults.length} result(s):\n`);
          searchResults.forEach((result, idx) => {
            console.log(`  ${idx + 1}. ${result.symbol.kind} ${result.symbol.qualifiedName} (similarity: ${(result.similarity * 100).toFixed(1)}%)`);
            console.log(`     Location: ${result.location.path}:${result.location.startLine}`);
            if (result.symbol.chunkSummary) {
              console.log(`     Summary: ${result.symbol.chunkSummary.slice(0, 80)}...`);
            }
            console.log();
          });
        }
      }

      index.close();
    } catch (error) {
      console.error('Error during embedding:', error);
      process.exit(1);
    }
  });

// Search command - semantic search
program
  .command('search <query>')
  .description('Semantic search for code symbols using embeddings')
  .option('--root <dir>', 'Root directory', '.')
  .option('--db <path>', 'Database path', '.codeindex/sqlite.db')
  .option('--config <path>', 'Config file path', 'codeindex.config.json')
  .option('--api-endpoint <url>', 'Embedding API endpoint')
  .option('--api-key <key>', 'Embedding API key')
  .option('--model <model>', 'Embedding model name')
  .option('--top-k <k>', 'Top-K results', '10')
  .option('--lang <language>', 'Filter by language')
  .option('--kind <kind>', 'Filter by symbol kind')
  .option('--min-similarity <score>', 'Minimum similarity score (0-1)', '0.7')
  .option('--json', 'Output as JSON')
  .action(async (query, options) => {
    try {
      const { CodeIndex } = await import('../index.js');
      
      // Load config file if present
      const configPath = join(process.cwd(), options.config || 'codeindex.config.json');
      const loadedConfig = existsSync(configPath)
        ? JSON.parse(readFileSync(configPath, 'utf-8'))
        : {};
      const embeddingConfig = (loadedConfig && loadedConfig.embedding) ? loadedConfig.embedding : {};

      const apiEndpoint = options.apiEndpoint || embeddingConfig.apiEndpoint;
      const apiKey = options.apiKey || embeddingConfig.apiKey || process.env.OPENAI_API_KEY;
      const model = options.model || embeddingConfig.model || embeddingConfig.defaultModel;
      const dimension = options.dimension ? parseInt(options.dimension) : embeddingConfig.dimension;

      if (!apiEndpoint || !apiKey) {
        console.error('Missing embedding configuration. Please set apiEndpoint/apiKey via config file or CLI flags.');
        process.exit(1);
      }

      if (!model) {
        console.error('Missing embedding model. Please set model via config file or --model flag.');
        process.exit(1);
      }

      // Resolve root/db
      const resolvedRoot = (options.root === '.' && loadedConfig.rootDir) ? loadedConfig.rootDir : options.root;
      const resolvedDb = (options.db === '.codeindex/sqlite.db' && loadedConfig.dbPath) ? loadedConfig.dbPath : options.db;
      const languages = loadedConfig.languages || ['ts', 'js'];

      const index = await CodeIndex.create({
        rootDir: resolvedRoot,
        dbPath: resolvedDb,
        languages: languages as Language[],
      });

      console.log(`🔍 Searching for: "${query}"\n`);

      const topK = parseInt(options.topK || '10');
      const minSimilarity = parseFloat(options.minSimilarity || '0.7');

      const searchResults = await index.semanticSearch({
        query,
        model,
        topK,
        language: options.lang as Language | undefined,
        kind: options.kind as SymbolKind | undefined,
        minSimilarity,
        embeddingOptions: {
          apiEndpoint,
          apiKey,
          model,
          ...(dimension ? { dimension } : {}),
        },
      });

      if (options.json) {
        console.log(JSON.stringify(searchResults, null, 2));
      } else {
        if (searchResults.length === 0) {
          console.log('No results found.');
          console.log('\nTip: Make sure you have generated embeddings first using "codeindex embed"');
        } else {
          console.log(`Found ${searchResults.length} result(s):\n`);
          searchResults.forEach((result, idx) => {
            console.log(`${idx + 1}. ${result.symbol.kind} ${result.symbol.qualifiedName}`);
            console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
            console.log(`   Location: ${result.location.path}:${result.location.startLine}`);
            if (result.symbol.chunkSummary) {
              const summary = result.symbol.chunkSummary.length > 100 
                ? result.symbol.chunkSummary.slice(0, 100) + '...' 
                : result.symbol.chunkSummary;
              console.log(`   Summary: ${summary}`);
            }
            console.log();
          });
        }
      }

      index.close();
    } catch (error) {
      console.error('Error during search:', error);
      process.exit(1);
    }
  });

function printCallChain(node: any, indent: number = 0, isLast: boolean = true, prefix: string = ''): void {
  // 根节点特殊处理
  if (indent === 0) {
    console.log(`\n🎯 调用链起点: ${node.name}`);
    console.log(`📍 位置: ${node.location.path}:${node.location.startLine}`);
    console.log(`📊 深度: ${node.depth}`);
    if (node.qualifiedName !== node.name) {
      console.log(`🏷️  完整名称: ${node.qualifiedName}`);
    }
    console.log('');
  } else {
    // 树形符号
    const connector = isLast ? '└─' : '├─';
    const symbol = indent === 1 ? '→' : '↳';
    
    console.log(`${prefix}${connector} ${symbol} ${node.name}`);
    console.log(`${prefix}${isLast ? '   ' : '│  '}   📄 ${node.location.path}:${node.location.startLine}`);
    
    if (node.qualifiedName !== node.name) {
      console.log(`${prefix}${isLast ? '   ' : '│  '}   🏷️  ${node.qualifiedName}`);
    }
  }
  
  if (node.children && node.children.length > 0) {
    node.children.forEach((child: any, index: number) => {
      const isLastChild = index === node.children.length - 1;
      const newPrefix = indent === 0 ? '' : prefix + (isLast ? '   ' : '│  ');
      printCallChain(child, indent + 1, isLastChild, newPrefix);
    });
  }
  
  // 根节点结束时打印分隔线
  if (indent === 0) {
    console.log('');
  }
}

program.parse();

