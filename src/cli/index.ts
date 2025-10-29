#!/usr/bin/env node

/**
 * CLI for CodeIndex
 */

import { Command } from 'commander';
import { CodeIndex } from '../index.js';
import type { Language } from '../core/types.js';
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

