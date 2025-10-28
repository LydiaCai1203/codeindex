/**
 * Test Go language indexing
 */

import { CodeIndex } from '../src/index.js';

async function main() {
  console.log('=== Go Language Indexing Test ===\n');

  // Create and initialize the index
  const index = await CodeIndex.create({
    rootDir: process.cwd(),
    dbPath: '.codeindex/go-example.db',
    languages: ['go'],
    include: ['examples/**/*.go'],
    exclude: ['**/node_modules/**'],
  });

  console.log('1. Indexing Go files...');
  await index.reindexAll();
  console.log('   ✓ Indexing complete\n');

  // Find a function
  console.log('2. Finding function "CreateUser"...');
  const createUserFn = await index.findSymbol({ name: 'CreateUser', language: 'go' });
  if (createUserFn) {
    console.log(`   ✓ Found: ${createUserFn.kind} ${createUserFn.qualifiedName}`);
    console.log(`     Location: Line ${createUserFn.startLine}-${createUserFn.endLine}`);
    console.log(`     Exported: ${createUserFn.exported}\n`);
  }

  // Find a struct (class)
  console.log('3. Finding struct "UserService"...');
  const userServiceStruct = await index.findSymbol({ name: 'UserService', kind: 'class', language: 'go' });
  if (userServiceStruct) {
    console.log(`   ✓ Found: ${userServiceStruct.kind} ${userServiceStruct.qualifiedName}\n`);

    // Get struct methods
    console.log('4. Getting UserService methods...');
    const methods = await index.objectProperties({ object: 'UserService' });
    console.log(`   ✓ Found ${methods.length} members:`);
    for (const method of methods) {
      console.log(`     - ${method.kind} ${method.name}`);
    }
    console.log();
  }

  // Find a struct type
  console.log('5. Finding struct "User"...');
  const userStruct = await index.findSymbol({ name: 'User', kind: 'class', language: 'go' });
  if (userStruct) {
    console.log(`   ✓ Found: ${userStruct.kind} ${userStruct.qualifiedName}`);
    
    // Get struct fields
    const fields = await index.objectProperties({ object: 'User' });
    console.log(`   ✓ Found ${fields.length} fields:`);
    for (const field of fields) {
      console.log(`     - ${field.kind} ${field.name}`);
    }
    console.log();
  }

  // Build call chain
  console.log('6. Building call chain for "ValidateEmail"...');
  const validateEmailFn = await index.findSymbol({ name: 'ValidateEmail', language: 'go' });
  if (validateEmailFn?.symbolId) {
    const chain = await index.callChain({
      from: validateEmailFn.symbolId,
      direction: 'backward', // Who calls this function?
      depth: 3,
    });

    if (chain) {
      console.log('   ✓ Call chain (backward - who calls ValidateEmail):');
      printChain(chain, 2);
    }
  }

  // Find all exported functions
  console.log('\n7. Finding exported functions...');
  const allSymbols = await index.findSymbols({ name: 'CreateUser', language: 'go' });
  console.log(`   ✓ Found ${allSymbols.length} symbol(s) matching "CreateUser"`);
  
  // Find interface
  console.log('\n8. Finding interface "Validator"...');
  const validatorInterface = await index.findSymbol({ name: 'Validator', kind: 'interface', language: 'go' });
  if (validatorInterface) {
    console.log(`   ✓ Found: ${validatorInterface.kind} ${validatorInterface.qualifiedName}`);
    console.log(`     Location: Line ${validatorInterface.startLine}\n`);
  }

  // Find constants and variables
  console.log('9. Finding constants...');
  const maxUsersConst = await index.findSymbol({ name: 'MaxUsers', language: 'go' });
  if (maxUsersConst) {
    console.log(`   ✓ Found: ${maxUsersConst.kind} ${maxUsersConst.qualifiedName}\n`);
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

