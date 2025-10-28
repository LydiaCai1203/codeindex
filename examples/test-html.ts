/**
 * Test HTML language indexing
 */

import { CodeIndex } from '../src/index.js';

async function main() {
  console.log('=== HTML Language Indexing Test ===\n');

  // Create and initialize the index
  const index = await CodeIndex.create({
    rootDir: process.cwd(),
    dbPath: '.codeindex/html-example.db',
    languages: ['html'],
    include: ['examples/**/*.html'],
    exclude: ['**/node_modules/**'],
  });

  console.log('1. Indexing HTML files...');
  await index.reindexAll();
  console.log('   ✓ Indexing complete\n');

  // Find an element by ID
  console.log('2. Finding element with ID "main-header"...');
  const mainHeader = await index.findSymbol({ name: 'main-header', language: 'html' });
  if (mainHeader) {
    console.log(`   ✓ Found: ${mainHeader.kind} ${mainHeader.qualifiedName}`);
    console.log(`     Location: Line ${mainHeader.startLine}-${mainHeader.endLine}`);
    console.log(`     Exported: ${mainHeader.exported}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find another ID
  console.log('3. Finding element with ID "user-form"...');
  const userForm = await index.findSymbol({ name: 'user-form', language: 'html' });
  if (userForm) {
    console.log(`   ✓ Found: ${userForm.kind} ${userForm.qualifiedName}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find ID that should be referenced
  console.log('4. Finding element with ID "submit-button"...');
  const submitButton = await index.findSymbol({ name: 'submit-button', language: 'html' });
  if (submitButton) {
    console.log(`   ✓ Found: ${submitButton.kind} ${submitButton.qualifiedName}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find class symbols
  console.log('5. Finding class "button"...');
  const buttonClass = await index.findSymbol({ name: 'button', language: 'html' });
  if (buttonClass) {
    console.log(`   ✓ Found: ${buttonClass.kind} ${buttonClass.qualifiedName}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find another class
  console.log('6. Finding class "container"...');
  const containerClass = await index.findSymbol({ name: 'container', language: 'html' });
  if (containerClass) {
    console.log(`   ✓ Found: ${containerClass.kind} ${containerClass.qualifiedName}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find custom component
  console.log('7. Finding custom element "user-card"...');
  const userCard = await index.findSymbol({ name: 'user-card', language: 'html' });
  if (userCard) {
    console.log(`   ✓ Found: ${userCard.kind} ${userCard.qualifiedName}`);
    console.log(`     Location: Line ${userCard.startLine}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find another custom component
  console.log('8. Finding custom element "app-sidebar"...');
  const appSidebar = await index.findSymbol({ name: 'app-sidebar', language: 'html' });
  if (appSidebar) {
    console.log(`   ✓ Found: ${appSidebar.kind} ${appSidebar.qualifiedName}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find script tag
  console.log('9. Finding script tag...');
  const scriptTag = await index.findSymbol({ name: 'script', language: 'html' });
  if (scriptTag) {
    console.log(`   ✓ Found: ${scriptTag.kind} ${scriptTag.qualifiedName}`);
    console.log(`     Location: Line ${scriptTag.startLine}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find style tag
  console.log('10. Finding style tag...');
  const styleTag = await index.findSymbol({ name: 'style', language: 'html' });
  if (styleTag) {
    console.log(`   ✓ Found: ${styleTag.kind} ${styleTag.qualifiedName}`);
    console.log(`     Location: Line ${styleTag.startLine}\n`);
  } else {
    console.log('   ✗ Not found\n');
  }

  // Find all IDs
  console.log('11. Finding all elements with IDs...');
  const allIds = await index.findSymbols({ name: 'main', language: 'html' });
  console.log(`   ✓ Found ${allIds.length} symbol(s) with "main" in name`);
  for (const symbol of allIds) {
    console.log(`     - ${symbol.qualifiedName} (${symbol.kind})`);
  }
  console.log();

  // Find all classes
  console.log('12. Finding all class symbols...');
  const allClasses = await index.findSymbols({ name: 'button', language: 'html' });
  console.log(`   ✓ Found ${allClasses.length} symbol(s) with "button" in name\n`);

  // Find elements with specific IDs that should exist
  const expectedIds = ['main-header', 'main-content', 'main-footer', 'site-title', 'user-form', 'submit-button'];
  console.log('13. Verifying expected IDs...');
  let foundCount = 0;
  for (const id of expectedIds) {
    const symbol = await index.findSymbol({ name: id, language: 'html' });
    if (symbol) {
      foundCount++;
      console.log(`   ✓ Found: #${id}`);
    } else {
      console.log(`   ✗ Missing: #${id}`);
    }
  }
  console.log(`   Total: ${foundCount}/${expectedIds.length} found\n`);

  index.close();
  console.log('=== Test Complete ===');
}

main().catch(console.error);

