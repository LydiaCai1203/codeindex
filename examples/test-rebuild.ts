/**
 * Test rebuild functionality
 */

import { CodeIndex } from '../src/index.js';

async function main() {
  console.log('=== Testing Rebuild Functionality ===\n');

  const index = await CodeIndex.create({
    rootDir: process.cwd(),
    dbPath: '.codeindex/rebuild-test.db',
    languages: ['ts', 'js'],
    include: ['examples/sample-code.ts'],
    exclude: ['**/node_modules/**'],
  });

  // First index
  console.log('1. Initial indexing...');
  await index.reindexAll();
  console.log('   ✓ Initial index complete\n');

  // Query to verify
  console.log('2. Querying symbols...');
  const symbols1 = await index.findSymbols({ name: 'greet' });
  console.log(`   ✓ Found ${symbols1.length} symbol(s) before rebuild\n`);

  // Rebuild
  console.log('3. Rebuilding index...');
  await index.rebuild();
  console.log('   ✓ Rebuild complete\n');

  // Query again
  console.log('4. Querying symbols after rebuild...');
  const symbols2 = await index.findSymbols({ name: 'greet' });
  console.log(`   ✓ Found ${symbols2.length} symbol(s) after rebuild\n`);

  // Verify results
  if (symbols1.length === symbols2.length) {
    console.log('✅ Rebuild successful - symbol counts match!');
  } else {
    console.log('⚠️  Warning - symbol counts differ');
    console.log(`   Before: ${symbols1.length}, After: ${symbols2.length}`);
  }

  index.close();
  console.log('\n=== Test Complete ===');
}

main().catch(console.error);

