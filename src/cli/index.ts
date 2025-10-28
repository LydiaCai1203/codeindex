#!/usr/bin/env node

/**
 * CLI for CodeIndex
 */

import { Command } from 'commander';
import { CodeIndex } from '../index.js';
import type { Language } from '../core/types.js';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const program = new Command();

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
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Created codeindex.config.json');
  });

// Index command
program
  .command('index')
  .description('Build or rebuild the code index')
  .option('--root <dir>', 'Root directory to index', '.')
  .option('--db <path>', 'Database path', '.codeindex/sqlite.db')
  .option('--lang <languages...>', 'Languages to index', ['ts', 'js'])
  .option('--include <patterns...>', 'Include patterns', ['**/*'])
  .option('--exclude <patterns...>', 'Exclude patterns', [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**',
  ])
  .option('--max-nested-depth <n>', 'Maximum depth for nested struct indexing (default: 3)', '3')
  .action(async (options) => {
    try {
      console.log('Starting indexing...');
      
      const index = await CodeIndex.create({
        rootDir: options.root,
        dbPath: options.db,
        languages: options.lang as Language[],
        include: options.include,
        exclude: options.exclude,
        maxNestedStructDepth: parseInt(options.maxNestedDepth),
      });

      await index.reindexAll();
      index.close();

      console.log('Indexing complete!');
    } catch (error) {
      console.error('Error during indexing:', error);
      process.exit(1);
    }
  });

// Rebuild command
program
  .command('rebuild')
  .description('Clear and rebuild the entire code index from scratch')
  .option('--root <dir>', 'Root directory to index', '.')
  .option('--db <path>', 'Database path', '.codeindex/sqlite.db')
  .option('--lang <languages...>', 'Languages to index', ['ts', 'js'])
  .option('--include <patterns...>', 'Include patterns', ['**/*'])
  .option('--exclude <patterns...>', 'Exclude patterns', [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**',
  ])
  .option('--max-nested-depth <n>', 'Maximum depth for nested struct indexing (default: 3)', '3')
  .action(async (options) => {
    try {
      console.log('Starting rebuild...');
      
      const index = await CodeIndex.create({
        rootDir: options.root,
        dbPath: options.db,
        languages: options.lang as Language[],
        include: options.include,
        exclude: options.exclude,
        maxNestedStructDepth: parseInt(options.maxNestedDepth),
      });

      await index.rebuild();
      index.close();

      console.log('Rebuild complete!');
    } catch (error) {
      console.error('Error during rebuild:', error);
      process.exit(1);
    }
  });

// Symbol command
program
  .command('symbol <name>')
  .description('Find a symbol by name')
  .option('--lang <language>', 'Filter by language')
  .option('--kind <kind>', 'Filter by symbol kind (function, class, etc.)')
  .option('--json', 'Output as JSON')
  .option('--db <path>', 'Database path', '.codeindex/sqlite.db')
  .action(async (name, options) => {
    try {
      const index = await CodeIndex.create({
        rootDir: '.',
        dbPath: options.db,
        languages: ['ts', 'js'],
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
  .requiredOption('--from <symbolId>', 'Starting symbol ID')
  .option('--direction <dir>', 'Direction: forward or backward', 'forward')
  .option('--depth <n>', 'Maximum depth', '5')
  .option('--pretty', 'Pretty print the call chain')
  .option('--json', 'Output as JSON')
  .option('--db <path>', 'Database path', '.codeindex/sqlite.db')
  .action(async (options) => {
    try {
      const index = await CodeIndex.create({
        rootDir: '.',
        dbPath: options.db,
        languages: ['ts', 'js'],
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

// Properties command
program
  .command('properties <objectName>')
  .description('Get properties and methods of an object/class/struct')
  .option('--lang <language>', 'Programming language filter (ts, js, go, python)')
  .option('--json', 'Output as JSON')
  .option('--db <path>', 'Database path', '.codeindex/sqlite.db')
  .action(async (objectName, options) => {
    try {
      const index = await CodeIndex.create({
        rootDir: '.',
        dbPath: options.db,
        languages: ['ts', 'js', 'go', 'python'],
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

