#!/usr/bin/env node
/**
 * 清理 package-lock.json 中的私有 npm 镜像地址
 * 将私有镜像地址替换为官方 registry 或移除 resolved 字段
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const lockFilePath = join(rootDir, 'package-lock.json');

// 私有镜像域名（需要替换的）
const PRIVATE_REGISTRY = 'npm.in.chaitin.net';
const OFFICIAL_REGISTRY = 'registry.npmjs.org';

// 读取 package-lock.json
const lockFile = JSON.parse(readFileSync(lockFilePath, 'utf-8'));

let replacedCount = 0;

/**
 * 递归清理对象中的 resolved 字段
 */
function cleanResolved(obj, path = '') {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      cleanResolved(item, `${path}[${index}]`);
    });
    return;
  }

  // 处理 resolved 字段
  if (obj.resolved && typeof obj.resolved === 'string') {
    if (obj.resolved.includes(PRIVATE_REGISTRY)) {
      // 方案1：替换为官方 registry
      obj.resolved = obj.resolved.replace(
        `https://${PRIVATE_REGISTRY}/`,
        `https://${OFFICIAL_REGISTRY}/`
      );
      replacedCount++;
      console.log(`✓ 替换: ${path}.resolved`);
      
      // 方案2：如果想完全移除 resolved 字段，取消下面的注释
      // delete obj.resolved;
      // console.log(`✓ 移除: ${path}.resolved`);
    }
  }

  // 递归处理所有属性
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cleanResolved(obj[key], path ? `${path}.${key}` : key);
    }
  }
}

console.log('🔍 开始清理 package-lock.json 中的私有镜像地址...\n');

// 清理
cleanResolved(lockFile);

if (replacedCount > 0) {
  // 写回文件
  writeFileSync(
    lockFilePath,
    JSON.stringify(lockFile, null, 2) + '\n',
    'utf-8'
  );
  
  console.log(`\n✅ 完成！共替换 ${replacedCount} 个私有镜像地址`);
  console.log(`📝 已更新: ${lockFilePath}`);
  console.log('\n⚠️  注意：请检查 .gitignore 确保 package-lock.json 不会被意外提交');
} else {
  console.log('\n✅ 未发现需要清理的私有镜像地址');
}

