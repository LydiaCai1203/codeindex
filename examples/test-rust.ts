/**
 * Test Rust language indexing
 */

import { CodeIndex } from '../src/index.js';

async function main() {
  console.log('=== Rust Language Indexing Test ===\n');

  // Create and initialize the index
  const index = await CodeIndex.create({
    rootDir: process.cwd(),
    dbPath: '.codeindex/rust-example.db',
    languages: ['rust'],
    include: ['examples/**/*.rs'],
    exclude: ['**/node_modules/**'],
  });

  console.log('1. Indexing Rust files...');
  await index.reindexAll();
  console.log('   ✓ Indexing complete\n');

  // Find a function
  console.log('2. Finding function "create_user"...');
  const createUserFn = await index.findSymbol({ name: 'create_user', language: 'rust' });
  if (createUserFn) {
    console.log(`   ✓ Found: ${createUserFn.kind} ${createUserFn.qualifiedName}`);
    console.log(`     Location: Line ${createUserFn.startLine}-${createUserFn.endLine}`);
    console.log(`     Exported: ${createUserFn.exported}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find a struct
  console.log('3. Finding struct "User"...');
  const userStruct = await index.findSymbol({ name: 'User', kind: 'struct', language: 'rust' });
  if (userStruct) {
    console.log(`   ✓ Found: ${userStruct.kind} ${userStruct.qualifiedName}\n`);

    // Get struct fields
    console.log('4. Getting User struct fields...');
    const fields = await index.objectProperties({ object: 'User', language: 'rust' });
    console.log(`   ✓ Found ${fields.length} members:`);
    for (const field of fields) {
      console.log(`     - ${field.kind} ${field.name}`);
    }
    console.log();
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find a struct with methods
  console.log('5. Finding struct "UserService"...');
  const userServiceStruct = await index.findSymbol({ name: 'UserService', kind: 'struct', language: 'rust' });
  if (userServiceStruct) {
    console.log(`   ✓ Found: ${userServiceStruct.kind} ${userServiceStruct.qualifiedName}\n`);

    // Get struct methods
    console.log('6. Getting UserService methods...');
    const methods = await index.objectProperties({ object: 'UserService', language: 'rust' });
    console.log(`   ✓ Found ${methods.length} members:`);
    for (const method of methods) {
      console.log(`     - ${method.kind} ${method.name}`);
    }
    console.log();
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find a trait
  console.log('7. Finding trait "Validator"...');
  const validatorTrait = await index.findSymbol({ name: 'Validator', kind: 'interface', language: 'rust' });
  if (validatorTrait) {
    console.log(`   ✓ Found: ${validatorTrait.kind} ${validatorTrait.qualifiedName}`);
    console.log(`     Location: Line ${validatorTrait.startLine}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find an enum
  console.log('8. Finding enum "UserRole"...');
  const userRoleEnum = await index.findSymbol({ name: 'UserRole', kind: 'type', language: 'rust' });
  if (userRoleEnum) {
    console.log(`   ✓ Found: ${userRoleEnum.kind} ${userRoleEnum.qualifiedName}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find constants
  console.log('9. Finding constants...');
  const maxUsersConst = await index.findSymbol({ name: 'MAX_USERS', language: 'rust' });
  if (maxUsersConst) {
    console.log(`   ✓ Found: ${maxUsersConst.kind} ${maxUsersConst.qualifiedName}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find static variables
  console.log('10. Finding static variables...');
  const debugModeStatic = await index.findSymbol({ name: 'DEBUG_MODE', language: 'rust' });
  if (debugModeStatic) {
    console.log(`   ✓ Found: ${debugModeStatic.kind} ${debugModeStatic.qualifiedName}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Build call chain
  console.log('11. Building call chain for "validate_email"...');
  const validateEmailFn = await index.findSymbol({ name: 'validate_email', language: 'rust' });
  if (validateEmailFn?.symbolId) {
    const chain = await index.callChain({
      from: validateEmailFn.symbolId,
      direction: 'backward', // Who calls this function?
      depth: 3,
    });

    if (chain) {
      console.log('   ✓ Call chain (backward - who calls validate_email):');
      printChain(chain, 2);
    } else {
      console.log('   ✗ No call chain found');
    }
  } else {
    console.log('   ✗ Function not found\n');
  }

  // Find all symbols matching "user"
  console.log('\n12. Finding all symbols with "user" in name...');
  const userSymbols = await index.findSymbols({ name: 'create_user', language: 'rust' });
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

