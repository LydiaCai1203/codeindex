/**
 * Test nested struct indexing with different depths
 */

import { CodeIndex } from '../dist/src/index.js';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_DB = '.codeindex/test-nested-struct.db';

// Clean up previous test db
if (existsSync(TEST_DB)) {
  unlinkSync(TEST_DB);
}

async function testNestedStruct(maxDepth: number) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 测试嵌套结构体索引 - 最大深度: ${maxDepth}`);
  console.log('='.repeat(70));

  const index = await CodeIndex.create({
    rootDir: './examples',
    dbPath: TEST_DB,
    languages: ['go'],
    include: ['nested-struct-test.go'],
    maxNestedStructDepth: maxDepth,
  });

  await index.reindexAll();

// Query all symbols - use database directly to get all symbols
  const db = (index as any).indexer.getDatabase();
  const allSymbols = db.getAllSymbols();
  const fields = allSymbols.filter((s: any) => s.kind === 'field');
  const structs = allSymbols.filter((s: any) => s.kind === 'struct');

  console.log(`\n📊 索引统计:`);
  console.log(`  - 结构体数量: ${structs.length}`);
  console.log(`  - 字段数量: ${fields.length}`);

  // Test specific nested fields
  console.log(`\n🔍 测试嵌套字段查找:`);

  // Depth 0: Person.Name
  const personName = await index.findSymbols({ name: 'Name' });
  const personNameField = personName.find(s => s.qualifiedName === 'main.Person.Name');
  console.log(`  ✓ Person.Name: ${personNameField ? '找到' : '未找到'}`);

  // Depth 1: Person.ContactInfo.Email
  const contactEmail = fields.find(s => s.qualifiedName === 'main.Person.ContactInfo.Email');
  console.log(`  ${contactEmail ? '✓' : '✗'} Person.ContactInfo.Email: ${contactEmail ? '找到' : '未找到'}`);

  // Depth 2: Person.ContactInfo.EmergencyContact.Name
  const emergencyName = fields.find(s => s.qualifiedName === 'main.Person.ContactInfo.EmergencyContact.Name');
  console.log(`  ${emergencyName ? '✓' : '✗'} Person.ContactInfo.EmergencyContact.Name: ${emergencyName ? '找到' : '未找到'}`);

  // Depth 3: Person.ContactInfo.EmergencyContact.Address.Street
  const addressStreet = fields.find(s => s.qualifiedName === 'main.Person.ContactInfo.EmergencyContact.Address.Street');
  console.log(`  ${addressStreet ? '✓' : '✗'} Person.ContactInfo.EmergencyContact.Address.Street: ${addressStreet ? '找到' : '未找到'}`);

  // Test deep nesting limit
  const level1 = fields.find(s => s.qualifiedName === 'main.DeepNesting.Level1');
  const level2Data = fields.find(s => s.qualifiedName === 'main.DeepNesting.Level1.Level2.Data');
  const level3Data = fields.find(s => s.qualifiedName === 'main.DeepNesting.Level1.Level2.Level3.Data');
  const level4Data = fields.find(s => s.qualifiedName === 'main.DeepNesting.Level1.Level2.Level3.Level4.Data');
  const level5Data = fields.find(s => s.qualifiedName === 'main.DeepNesting.Level1.Level2.Level3.Level4.Level5.Data');

  console.log(`\n🌳 深度嵌套测试 (DeepNesting):`);
  console.log(`  ${level1 ? '✓' : '✗'} Level1 (深度 0): ${level1 ? '找到' : '未找到'}`);
  console.log(`  ${level2Data ? '✓' : '✗'} Level1.Level2.Data (深度 1): ${level2Data ? '找到' : '未找到'}`);
  console.log(`  ${level3Data ? '✓' : '✗'} Level1.Level2.Level3.Data (深度 2): ${level3Data ? '找到' : '未找到'}`);
  console.log(`  ${level4Data ? '✓' : '✗'} Level1.Level2.Level3.Level4.Data (深度 3): ${level4Data ? '找到' : '未找到'}`);
  console.log(`  ${level5Data ? '✓' : '✗'} Level1.Level2.Level3.Level4.Level5.Data (深度 4): ${level5Data ? '找到' : '未找到'}`);

  // Show all fields for debugging
  if (process.argv.includes('--verbose')) {
    console.log(`\n📋 所有索引的字段:`);
    fields.sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName)).forEach(f => {
      const depth = (f.qualifiedName.match(/\./g) || []).length - 1;
      console.log(`  [深度 ${depth}] ${f.qualifiedName}`);
    });
  }

  index.close();

  // Verify expectations based on max depth
  let passed = true;
  if (maxDepth >= 1 && !contactEmail) {
    console.log(`\n❌ 测试失败: 应该能找到深度 1 的字段`);
    passed = false;
  }
  if (maxDepth >= 2 && !emergencyName) {
    console.log(`\n❌ 测试失败: 应该能找到深度 2 的字段`);
    passed = false;
  }
  if (maxDepth >= 3 && !addressStreet) {
    console.log(`\n❌ 测试失败: 应该能找到深度 3 的字段`);
    passed = false;
  }
  if (maxDepth < 3 && addressStreet) {
    console.log(`\n❌ 测试失败: 不应该索引超过最大深度的字段`);
    passed = false;
  }

  return passed;
}

// Run tests with different depths
async function runAllTests() {
  console.log('🚀 开始嵌套结构体索引测试\n');

  const depths = [0, 1, 2, 3, 5];
  let allPassed = true;

  for (const depth of depths) {
    const passed = await testNestedStruct(depth);
    if (!passed) allPassed = false;
  }

  console.log(`\n${'='.repeat(70)}`);
  if (allPassed) {
    console.log('✅ 所有测试通过!');
  } else {
    console.log('❌ 部分测试失败');
  }
  console.log('='.repeat(70));

  // Clean up
  if (existsSync(TEST_DB)) {
    unlinkSync(TEST_DB);
  }
}

runAllTests().catch(console.error);

