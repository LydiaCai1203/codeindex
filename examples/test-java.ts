/**
 * Test Java language indexing
 */

import { CodeIndex } from '../src/index.js';

async function main() {
  console.log('=== Java Language Indexing Test ===\n');

  // Create and initialize the index
  const index = await CodeIndex.create({
    rootDir: process.cwd(),
    dbPath: '.codeindex/java-example.db',
    languages: ['java'],
    include: ['examples/**/*.java'],
    exclude: ['**/node_modules/**'],
  });

  console.log('1. Indexing Java files...');
  await index.reindexAll();
  console.log('   ✓ Indexing complete\n');

  // Find a class
  console.log('2. Finding class "User"...');
  const userClass = await index.findSymbol({ name: 'User', kind: 'class', language: 'java' });
  if (userClass) {
    console.log(`   ✓ Found: ${userClass.kind} ${userClass.qualifiedName}`);
    console.log(`     Location: Line ${userClass.startLine}-${userClass.endLine}`);
    console.log(`     Exported: ${userClass.exported}\n`);

    // Get class methods and fields
    console.log('3. Getting User class members...');
    const members = await index.objectProperties({ object: 'User', language: 'java' });
    console.log(`   ✓ Found ${members.length} members:`);
    for (const member of members) {
      console.log(`     - ${member.kind} ${member.name}`);
    }
    console.log();
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find a class with methods
  console.log('4. Finding class "UserService"...');
  const userServiceClass = await index.findSymbol({ name: 'UserService', kind: 'class', language: 'java' });
  if (userServiceClass) {
    console.log(`   ✓ Found: ${userServiceClass.kind} ${userServiceClass.qualifiedName}\n`);

    // Get class methods
    console.log('5. Getting UserService methods...');
    const methods = await index.objectProperties({ object: 'UserService', language: 'java' });
    console.log(`   ✓ Found ${methods.length} members:`);
    for (const method of methods) {
      console.log(`     - ${method.kind} ${method.name}`);
    }
    console.log();
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find an interface
  console.log('6. Finding interface "Validator"...');
  const validatorInterface = await index.findSymbol({ name: 'Validator', kind: 'interface', language: 'java' });
  if (validatorInterface) {
    console.log(`   ✓ Found: ${validatorInterface.kind} ${validatorInterface.qualifiedName}`);
    console.log(`     Location: Line ${validatorInterface.startLine}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find an enum
  console.log('7. Finding enum "UserRole"...');
  const userRoleEnum = await index.findSymbol({ name: 'UserRole', kind: 'type', language: 'java' });
  if (userRoleEnum) {
    console.log(`   ✓ Found: ${userRoleEnum.kind} ${userRoleEnum.qualifiedName}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find a method
  console.log('8. Finding method "createUser"...');
  const createUserMethod = await index.findSymbol({ name: 'createUser', kind: 'method', language: 'java' });
  if (createUserMethod) {
    console.log(`   ✓ Found: ${createUserMethod.kind} ${createUserMethod.qualifiedName}`);
    console.log(`     Location: Line ${createUserMethod.startLine}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find a constructor
  console.log('9. Finding constructor "User"...');
  const userConstructors = await index.findSymbols({ name: 'User', language: 'java' });
  const constructor = userConstructors.find(s => s.kind === 'method' && s.name === 'User');
  if (constructor) {
    console.log(`   ✓ Found: ${constructor.kind} ${constructor.qualifiedName}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find constants
  console.log('10. Finding constants...');
  const maxUsersConst = await index.findSymbol({ name: 'MAX_USERS', language: 'java' });
  if (maxUsersConst) {
    console.log(`   ✓ Found: ${maxUsersConst.kind} ${maxUsersConst.qualifiedName}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Build call chain
  console.log('11. Building call chain for "validateEmail"...');
  const validateEmailMethod = await index.findSymbol({ name: 'validateEmail', language: 'java' });
  if (validateEmailMethod?.symbolId) {
    const chain = await index.callChain({
      from: validateEmailMethod.symbolId,
      direction: 'backward', // Who calls this method?
      depth: 3,
    });

    if (chain) {
      console.log('   ✓ Call chain (backward - who calls validateEmail):');
      printChain(chain, 2);
    } else {
      console.log('   ✗ No call chain found');
    }
  } else {
    console.log('   ✗ Method not found\n');
  }

  // Find abstract class
  console.log('\n12. Finding abstract class "BaseService"...');
  const baseServiceClass = await index.findSymbol({ name: 'BaseService', kind: 'class', language: 'java' });
  if (baseServiceClass) {
    console.log(`   ✓ Found: ${baseServiceClass.kind} ${baseServiceClass.qualifiedName}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find class extending another class
  console.log('13. Finding class "AdminService" (extends BaseService)...');
  const adminServiceClass = await index.findSymbol({ name: 'AdminService', kind: 'class', language: 'java' });
  if (adminServiceClass) {
    console.log(`   ✓ Found: ${adminServiceClass.kind} ${adminServiceClass.qualifiedName}\n`);
    
    const methods = await index.objectProperties({ object: 'AdminService', language: 'java' });
    console.log(`   ✓ Found ${methods.length} members in AdminService:`);
    for (const method of methods) {
      console.log(`     - ${method.kind} ${method.name}`);
    }
    console.log();
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find all symbols matching "user"
  console.log('14. Finding all symbols with "user" in name...');
  const userSymbols = await index.findSymbols({ name: 'User', language: 'java' });
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

