/**
 * Demo of nested struct indexing with different depths
 */

import { CodeIndex } from '../dist/src/index.js';
import { unlinkSync, existsSync } from 'fs';

async function demoNestedStruct() {
  console.log('🚀 嵌套结构体索引演示\n');

  const maxDepth = parseInt(process.argv[2] || '3');
  const dbPath = '.codeindex/demo-nested.db';

  // Clean up previous db
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  console.log(`📝 配置: maxNestedStructDepth = ${maxDepth}`);
  console.log('📂 文件: examples/nested-struct-test.go\n');

  const index = await CodeIndex.create({
    rootDir: './examples',
    dbPath,
    languages: ['go'],
    include: ['nested-struct-test.go'],
    maxNestedStructDepth: maxDepth,
  });

  await index.reindexAll();

  console.log('✅ 索引完成！\n');
  console.log('🔍 查询嵌套字段示例:\n');

  // Query ContactInfo fields
  const emailSymbols = await index.findSymbols({ name: 'Email' });
  console.log(`📧 Email 字段 (找到 ${emailSymbols.length} 个):`);
  emailSymbols.forEach(s => {
    const depth = (s.qualifiedName.match(/\./g) || []).length - 1;
    console.log(`   [深度 ${depth}] ${s.qualifiedName}`);
  });

  // Query Data fields
  const dataSymbols = await index.findSymbols({ name: 'Data' });
  console.log(`\n📊 Data 字段 (找到 ${dataSymbols.length} 个):`);
  dataSymbols.forEach(s => {
    const depth = (s.qualifiedName.match(/\./g) || []).length - 1;
    console.log(`   [深度 ${depth}] ${s.qualifiedName}`);
  });

  // Query Street fields
  const streetSymbols = await index.findSymbols({ name: 'Street' });
  console.log(`\n🏠 Street 字段 (找到 ${streetSymbols.length} 个):`);
  streetSymbols.forEach(s => {
    const depth = (s.qualifiedName.match(/\./g) || []).length - 1;
    console.log(`   [深度 ${depth}] ${s.qualifiedName}`);
  });

  index.close();

  // Clean up
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  console.log('\n✨ 演示完成！');
  console.log(`\n💡 提示: 使用不同的深度值运行:`);
  console.log(`   node examples/demo-nested-struct.ts 0  # 不索引嵌套字段`);
  console.log(`   node examples/demo-nested-struct.ts 1  # 索引深度 1`);
  console.log(`   node examples/demo-nested-struct.ts 3  # 索引深度 3 (默认)`);
  console.log(`   node examples/demo-nested-struct.ts 5  # 索引深度 5`);
}

demoNestedStruct().catch(console.error);

