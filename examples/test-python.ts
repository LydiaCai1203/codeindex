/**
 * Test Python language indexing
 */

import { CodeIndex } from '../src/index.js';

async function main() {
  console.log('=== Python Language Indexing Test ===\n');

  // Create and initialize the index
  const index = await CodeIndex.create({
    rootDir: process.cwd(),
    dbPath: '.codeindex/python-example.db',
    languages: ['python'],
    include: ['examples/**/*.py'],
    exclude: ['**/node_modules/**', '**/__pycache__/**'],
  });

  console.log('1. Indexing Python files...');
  await index.reindexAll();
  console.log('   ✓ Indexing complete\n');

  // Find a function
  console.log('2. Finding function "create_user"...');
  const createUserFn = await index.findSymbol({ name: 'create_user', language: 'python' });
  if (createUserFn) {
    console.log(`   ✓ Found: ${createUserFn.kind} ${createUserFn.qualifiedName}`);
    console.log(`     Location: Line ${createUserFn.startLine}-${createUserFn.endLine}`);
    console.log(`     Exported: ${createUserFn.exported}\n`);
  }

  // Find a class
  console.log('3. Finding class "UserService"...');
  const userServiceClass = await index.findSymbol({ name: 'UserService', kind: 'class', language: 'python' });
  if (userServiceClass) {
    console.log(`   ✓ Found: ${userServiceClass.kind} ${userServiceClass.qualifiedName}\n`);

    // Get class methods
    console.log('4. Getting UserService methods...');
    const methods = await index.objectProperties({ object: 'UserService' });
    console.log(`   ✓ Found ${methods.length} members:`);
    for (const method of methods) {
      console.log(`     - ${method.kind} ${method.name}`);
    }
    console.log();
  }

  // Find a class with inheritance
  console.log('5. Finding class "User"...');
  const userClass = await index.findSymbol({ name: 'User', kind: 'class', language: 'python' });
  if (userClass) {
    console.log(`   ✓ Found: ${userClass.kind} ${userClass.qualifiedName}`);
    
    // Get class methods
    const methods = await index.objectProperties({ object: 'User' });
    console.log(`   ✓ Found ${methods.length} members:`);
    for (const method of methods) {
      console.log(`     - ${method.kind} ${method.name}`);
    }
    console.log();
  }

  // Find inherited class
  console.log('6. Finding class "AdminUser" (inherits from User)...');
  const adminClass = await index.findSymbol({ name: 'AdminUser', kind: 'class', language: 'python' });
  if (adminClass) {
    console.log(`   ✓ Found: ${adminClass.kind} ${adminClass.qualifiedName}`);
    
    const methods = await index.objectProperties({ object: 'AdminUser' });
    console.log(`   ✓ Found ${methods.length} members:`);
    for (const method of methods) {
      console.log(`     - ${method.kind} ${method.name}`);
    }
    console.log();
  }

  // Build call chain
  console.log('7. Building call chain for "validate_email"...');
  const validateEmailFn = await index.findSymbol({ name: 'validate_email', language: 'python' });
  if (validateEmailFn?.symbolId) {
    const chain = await index.callChain({
      from: validateEmailFn.symbolId,
      direction: 'backward', // Who calls this function?
      depth: 3,
    });

    if (chain) {
      console.log('   ✓ Call chain (backward - who calls validate_email):');
      printChain(chain, 2);
    }
  }

  // Find decorated function
  console.log('\n8. Finding decorated function "process_user_batch"...');
  const decoratedFn = await index.findSymbol({ name: 'process_user_batch', language: 'python' });
  if (decoratedFn) {
    console.log(`   ✓ Found: ${decoratedFn.kind} ${decoratedFn.qualifiedName}`);
    console.log(`     Location: Line ${decoratedFn.startLine}\n`);
  }

  // Find constants
  console.log('9. Finding constants...');
  const maxUsersConst = await index.findSymbol({ name: 'MAX_USERS', language: 'python' });
  if (maxUsersConst) {
    console.log(`   ✓ Found: ${maxUsersConst.kind} ${maxUsersConst.qualifiedName}\n`);
  }

  // Find property
  console.log('10. Finding property "is_valid"...');
  const isValidProp = await index.findSymbol({ name: 'is_valid', language: 'python' });
  if (isValidProp) {
    console.log(`   ✓ Found: ${isValidProp.kind} ${isValidProp.qualifiedName}`);
    console.log(`      (decorated with @property)\n`);
  }

  // Find special methods
  console.log('11. Finding special method "__init__"...');
  const initMethod = await index.findSymbol({ name: '__init__', language: 'python' });
  if (initMethod) {
    console.log(`   ✓ Found: ${initMethod.kind} ${initMethod.qualifiedName}\n`);
  }

  // Find all symbols matching "user"
  console.log('12. Finding all symbols with "user" in name...');
  const userSymbols = await index.findSymbols({ name: 'create_user', language: 'python' });
  console.log(`   ✓ Found ${userSymbols.length} symbol(s)\n`);

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

