/**
 * Example usage of CodeIndex API
 */

import { CodeIndex } from '../src/index.js';

async function main() {
  console.log('=== CodeIndex Example ===\n');

  // Create and initialize the index
  const index = await CodeIndex.create({
    rootDir: process.cwd(),
    dbPath: '.codeindex/example.db',
    languages: ['ts', 'js'],
    include: ['examples/**/*.ts'],
    exclude: ['**/node_modules/**'],
  });

  console.log('1. Indexing files...');
  await index.reindexAll();
  console.log('   ✓ Indexing complete\n');

  // Find a function
  console.log('2. Finding symbol "greet"...');
  const greetSymbol = await index.findSymbol({ name: 'greet' });
  if (greetSymbol) {
    console.log(`   ✓ Found: ${greetSymbol.kind} ${greetSymbol.qualifiedName}`);
    console.log(`     Location: Line ${greetSymbol.startLine}-${greetSymbol.endLine}`);
    console.log(`     Exported: ${greetSymbol.exported}\n`);
  }

  // Find a class
  console.log('3. Finding class "Calculator"...');
  const calcSymbol = await index.findSymbol({ name: 'Calculator', kind: 'class' });
  if (calcSymbol) {
    console.log(`   ✓ Found: ${calcSymbol.kind} ${calcSymbol.qualifiedName}\n`);

    // Get class properties
    console.log('4. Getting Calculator properties...');
    const properties = await index.objectProperties({ object: 'Calculator' });
    console.log(`   ✓ Found ${properties.length} members:`);
    for (const prop of properties) {
      console.log(`     - ${prop.kind} ${prop.name}`);
    }
    console.log();
  }

  // Build call chain
  console.log('5. Building call chain...');
  if (greetSymbol?.symbolId) {
    const chain = await index.callChain({
      from: greetSymbol.symbolId,
      direction: 'backward', // Who calls this function?
      depth: 3,
    });

    if (chain) {
      console.log('   ✓ Call chain (backward - who calls greet):');
      printChain(chain, 2);
    }
  }

  // Find all functions
  console.log('\n6. Finding all exported functions...');
  const allSymbols = await index.findSymbols({ name: 'greet' });
  console.log(`   ✓ Found ${allSymbols.length} symbol(s) matching "greet"\n`);

  index.close();
  console.log('=== Example Complete ===');
}

function printChain(node: any, indent: number) {
  const prefix = ' '.repeat(indent);
  console.log(`${prefix}→ ${node.name} (depth: ${node.depth})`);
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      printChain(child, indent + 2);
    }
  }
}

main().catch(console.error);

