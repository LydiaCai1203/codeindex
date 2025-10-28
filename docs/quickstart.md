# 快速开始（Quickstart）

## 安装与构建
```sh
npm install
npm run build
```

## 为项目建立索引
通用示例：
```sh
node dist/src/cli/index.js index \
  --root /path/to/project \
  --db .codeindex/project.db \
  --lang go \
  --include "**/*.go" \
  --exclude "**/vendor/**" "**/.git/**"
```

monkeycode-ai 示例（你的仓库）：
```sh
node dist/src/cli/index.js index \
  --root /Users/caiqj/project/company/new/monkeycode-ai \
  --db .codeindex/monkeycode-ai.db \
  --lang go \
  --include "**/*.go" \
  --exclude "**/vendor/**" "**/.git/**" "**/pg_data/**" "**/data/**" "**/build/**" "**/bin/**"
```

## 重建索引
```sh
node dist/src/cli/index.js rebuild \
  --root /Users/caiqj/project/company/new/monkeycode-ai \
  --db .codeindex/monkeycode-ai.db \
  --lang go
```

## 常用查询
- 查找符号：
```sh
node dist/src/cli/index.js symbol "BindRepoReq" \
  --lang go \
  --db .codeindex/monkeycode-ai.db \
  --json
```
- 查看结构体/接口的字段与方法：
```sh
node dist/src/cli/index.js properties "Giter" \
  --lang go \
  --db .codeindex/monkeycode-ai.db
```
- 生成调用链（树形美化）：
```sh
node dist/src/cli/index.js call-chain \
  --from <symbolId> \
  --direction forward \
  --depth 3 \
  --db .codeindex/monkeycode-ai.db \
  --pretty
```

## Node.js API 示例
```ts
import { CodeIndex } from './src/index.js';

const index = await CodeIndex.create({
  rootDir: '/Users/caiqj/project/company/new/monkeycode-ai',
  dbPath: '.codeindex/monkeycode-ai.db',
  languages: ['go']
});

// interface 方法与 struct 字段/方法
const giterMethods = await index.objectProperties({ object: 'Giter', language: 'go' });

// 调用链（正向，限制深度）
const chain = await index.callChain({ from: 12345, direction: 'forward', depth: 3 });

index.close();
```

## 小贴士
- 用 `--json` 获取机器友好的输出
- 调用链的 `depth` 建议从 1-2 开始，按需增大
- 更多能力与覆盖范围请见 `@docs/language-support.md`
