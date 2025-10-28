/**
 * Test TypeScript/JavaScript language indexing
 */

import { CodeIndex } from '../src/index.js';

async function main() {
  console.log('=== TypeScript/JavaScript Language Indexing Test ===\n');

  // Create and initialize the index
  const index = await CodeIndex.create({
    rootDir: process.cwd(),
    dbPath: '.codeindex/typescript-example.db',
    languages: ['ts', 'js'],
    include: ['examples/**/*.ts', 'examples/**/*.js'],
    exclude: ['**/node_modules/**', '**/*.test.ts', '**/*.spec.ts'],
  });

  console.log('1. Indexing TypeScript/JavaScript files...');
  await index.reindexAll();
  console.log('   ✓ Indexing complete\n');

  // Find a function
  console.log('2. Finding function "greet"...');
  const greetFn = await index.findSymbol({ name: 'greet', language: 'ts' });
  if (greetFn) {
    console.log(`   ✓ Found: ${greetFn.kind} ${greetFn.qualifiedName}`);
    console.log(`     Location: Line ${greetFn.startLine}-${greetFn.endLine}`);
    console.log(`     Exported: ${greetFn.exported}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find a function that calls another function
  console.log('3. Finding function "greetUser"...');
  const greetUserFn = await index.findSymbol({ name: 'greetUser', language: 'ts' });
  if (greetUserFn) {
    console.log(`   ✓ Found: ${greetUserFn.kind} ${greetUserFn.qualifiedName}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find a class
  console.log('4. Finding class "Calculator"...');
  const calculatorClass = await index.findSymbol({ name: 'Calculator', kind: 'class', language: 'ts' });
  if (calculatorClass) {
    console.log(`   ✓ Found: ${calculatorClass.kind} ${calculatorClass.qualifiedName}\n`);

    // Get class methods
    console.log('5. Getting Calculator methods...');
    const methods = await index.objectProperties({ object: 'Calculator', language: 'ts' });
    console.log(`   ✓ Found ${methods.length} members:`);
    for (const method of methods) {
      console.log(`     - ${method.kind} ${method.name}`);
    }
    console.log();
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find an interface
  console.log('6. Finding interface "User"...');
  const userInterface = await index.findSymbol({ name: 'User', kind: 'interface', language: 'ts' });
  if (userInterface) {
    console.log(`   ✓ Found: ${userInterface.kind} ${userInterface.qualifiedName}`);
    console.log(`     Location: Line ${userInterface.startLine}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find a type alias
  console.log('7. Finding type alias "UserId"...');
  const userIdType = await index.findSymbol({ name: 'UserId', kind: 'type', language: 'ts' });
  if (userIdType) {
    console.log(`   ✓ Found: ${userIdType.kind} ${userIdType.qualifiedName}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find an async function
  console.log('8. Finding async function "fetchAndGreet"...');
  const fetchAndGreetFn = await index.findSymbol({ name: 'fetchAndGreet', language: 'ts' });
  if (fetchAndGreetFn) {
    console.log(`   ✓ Found: ${fetchAndGreetFn.kind} ${fetchAndGreetFn.qualifiedName}`);
    console.log(`     Location: Line ${fetchAndGreetFn.startLine}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Build call chain
  console.log('9. Building call chain for "greet"...');
  const greetSymbol = await index.findSymbol({ name: 'greet', language: 'ts' });
  if (greetSymbol?.symbolId) {
    const chain = await index.callChain({
      from: greetSymbol.symbolId,
      direction: 'backward', // Who calls this function?
      depth: 3,
    });

    if (chain) {
      console.log('   ✓ Call chain (backward - who calls greet):');
      printChain(chain, 2);
    } else {
      console.log('   ✗ No call chain found');
    }
  } else {
    console.log('   ✗ Function not found\n');
  }

  // Find function that calls greet
  console.log('\n10. Building call chain for "greetUser" (forward)...');
  const greetUserSymbol = await index.findSymbol({ name: 'greetUser', language: 'ts' });
  if (greetUserSymbol?.symbolId) {
    const chain = await index.callChain({
      from: greetUserSymbol.symbolId,
      direction: 'forward', // What does this function call?
      depth: 3,
    });

    if (chain) {
      console.log('   ✓ Call chain (forward - what greetUser calls):');
      printChain(chain, 2);
    } else {
      console.log('   ✗ No call chain found');
    }
  } else {
    console.log('   ✗ Function not found\n');
  }

  // Find all exported functions
  console.log('\n11. Finding all exported functions...');
  const allSymbols = await index.findSymbols({ name: 'greet', language: 'ts' });
  console.log(`   ✓ Found ${allSymbols.length} symbol(s) matching "greet"`);
  for (const symbol of allSymbols) {
    console.log(`     - ${symbol.kind} ${symbol.qualifiedName} (exported: ${symbol.exported})`);
  }
  console.log();

  // Find class methods
  console.log('12. Finding class methods in Calculator...');
  const calcMethods = await index.objectProperties({ object: 'Calculator', language: 'ts' });
  console.log(`   ✓ Found ${calcMethods.length} methods/properties:`);
  for (const method of calcMethods) {
    console.log(`     - ${method.kind} ${method.name}`);
  }
  console.log();

  // Find function that uses class
  console.log('13. Finding function "calculateSum" (uses Calculator)...');
  const calculateSumFn = await index.findSymbol({ name: 'calculateSum', language: 'ts' });
  if (calculateSumFn) {
    console.log(`   ✓ Found: ${calculateSumFn.kind} ${calculateSumFn.qualifiedName}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  index.close();
  console.log('=== Test Complete ===');
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

