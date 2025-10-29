/**
 * Test the chunk summarizer functionality
 */

import { CodeIndex } from '../src/index.js';
import { ChunkSummarizer } from '../src/summarizer/chunk-summarizer.js';

async function main() {
  const dbPath = '.codeindex/test-summary.db';
  
  console.log('Step 1: Creating index...');
  const index = await CodeIndex.create({
    rootDir: '/Users/caiqj/project/company/new/codeindex/monkeycode-ai',
    dbPath,
    languages: ['go'],
    include: ['**/*.go'],
    exclude: ['**/vendor/**', '**/.git/**'],
    maxNestedStructDepth: 3,
  });

  console.log('\nStep 2: Rebuilding index...');
  await index.rebuild();

  const db = (index as any).indexer.getDatabase();
  const symbolsNeedingSummary = db.getSymbolsNeedingSummary();
  console.log(`\nStep 3: Found ${symbolsNeedingSummary.length} symbols needing summary`);

  if (symbolsNeedingSummary.length > 0) {
    console.log('\nFirst 5 symbols:');
    symbolsNeedingSummary.slice(0, 5).forEach((s: any) => {
      console.log(`  - ${s.kind} ${s.qualifiedName} (${s.startLine}-${s.endLine})`);
    });
  }

  // Test with a mock API (replace with real API in production)
  console.log('\nStep 4: Testing summarizer (mock mode)...');
  
  // Uncomment below to test with real API
  /*
  const summarizer = new ChunkSummarizer({
    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4o-mini',
    concurrency: 3,
  });

  const results = await summarizer.summarizeAll(
    db,
    '/Users/caiqj/project/company/new/codeindex/monkeycode-ai',
    (current, total, symbol) => {
      console.log(`  [${current}/${total}] ${symbol.kind} ${symbol.qualifiedName}`);
    }
  );

  console.log('\nResults:');
  console.log(`  Successful: ${results.filter(r => !r.error).length}`);
  console.log(`  Failed: ${results.filter(r => r.error).length}`);
  console.log(`  Total tokens: ${results.reduce((sum, r) => sum + r.tokens, 0)}`);

  // Show first 3 summaries
  console.log('\nFirst 3 summaries:');
  results.filter(r => !r.error).slice(0, 3).forEach(r => {
    const symbol = db.getSymbolById(r.symbolId);
    console.log(`\n${symbol.kind} ${symbol.qualifiedName}:`);
    console.log(`  ${r.summary}`);
  });
  */

  console.log('\n✅ Test complete! To run with real API, uncomment the code and set OPENAI_API_KEY');
  
  index.close();
}

main().catch(console.error);

