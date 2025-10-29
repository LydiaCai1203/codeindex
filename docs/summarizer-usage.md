# 代码块摘要功能使用指南

## 概述
代码块摘要功能可以为索引中的每个符号（函数、类、结构体等）生成 AI 驱动的中文说明，提升代码检索的语义准确度。

## 功能特性
- ✅ 基于符号粒度的代码分块
- ✅ LLM 自动生成中文摘要
- ✅ 增量更新（基于 chunk_hash 判断是否需要重新生成）
- ✅ 并发控制与重试机制
- ✅ Token 使用统计

## 使用方式

> **推荐**：所有命令现在都支持从 `codeindex.config.json` 读取默认配置，CLI 参数可覆盖配置值。

### 1. 通过配置文件使用（推荐）

你可以将所有配置固化到 `codeindex.config.json` 中，运行 `codeindex init` 会生成基础模板，已包含 `summarizer` 段落：

```json
{
  "rootDir": ".",
  "dbPath": ".codeindex/sqlite.db",
  "languages": ["ts", "js"],
  "include": ["src/**/*", "lib/**/*"],
  "exclude": ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**"],
  "concurrency": 4,
  "summarizer": {
    "apiEndpoint": "https://api.openai.com/v1/chat/completions",
    "apiKey": "",
    "model": "gpt-4o-mini",
    "concurrency": 5,
    "maxRetries": 3
  }
}
```

将 `summarizer.apiKey` 填写为你的密钥，或通过环境变量 `OPENAI_API_KEY` 提供。然后构建并运行：

```bash
npm run build
node dist/cli/index.js summarize
```

如需临时覆盖配置文件中的模型或端点：

```bash
node dist/cli/index.js summarize \
  --model gpt-4o-mini \
  --api-endpoint https://api.openai.com/v1/chat/completions
```

### 2. 其他命令也支持配置文件

所有命令（`index`、`rebuild`、`symbol`、`call-chain`、`properties`、`summarize`）现在都会自动读取 `codeindex.config.json`：

```bash
# 索引代码（读取 rootDir/dbPath/languages/include/exclude）
node dist/cli/index.js index

# 重建索引
node dist/cli/index.js rebuild

# 查询符号（读取 dbPath）
node dist/cli/index.js symbol MyFunction

# 生成调用链（读取 dbPath）
node dist/cli/index.js call-chain --from 123 --pretty

# 查询对象属性（读取 dbPath/languages）
node dist/cli/index.js properties MyStruct
```

所有命令都支持 `--config <path>` 指定配置文件路径（默认 `codeindex.config.json`），CLI 参数会覆盖配置值。

### 3. 编程方式使用

```typescript
import { CodeDatabase } from './storage/database.js';
import { ChunkSummarizer } from './summarizer/chunk-summarizer.js';

const db = new CodeDatabase('.codeindex/sqlite.db');
const summarizer = new ChunkSummarizer({
  apiEndpoint: 'https://api.openai.com/v1/chat/completions',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini',
  concurrency: 5,
  maxRetries: 3,
});

const results = await summarizer.summarizeAll(
  db,
  '/path/to/project',
  (current, total, symbol) => {
    console.log(`[${current}/${total}] ${symbol.qualifiedName}`);
  }
);

console.log(`成功: ${results.filter(r => !r.error).length}`);
console.log(`失败: ${results.filter(r => r.error).length}`);
console.log(`总 Token: ${results.reduce((sum, r) => sum + r.tokens, 0)}`);
```

## 数据库 Schema 变更

新增字段（已添加到 `symbols` 表）：
- `chunk_hash`: 代码块内容哈希
- `chunk_summary`: AI 生成的摘要文本
- `summary_tokens`: 消耗的 token 数
- `summarized_at`: 摘要生成时间戳

## 查询摘要

### 通过 API
```typescript
const symbol = db.getSymbolById(symbolId);
console.log(symbol.chunkSummary); // 输出摘要
```

### 通过 CLI
```bash
npx tsx src/cli/index.ts symbol MyFunction --json
```

输出会包含 `chunkSummary` 字段。

## 增量更新

摘要生成器会自动检测代码块是否变化：
1. 首次运行：为所有符号生成摘要
2. 后续运行：只为新增或变更的符号重新生成摘要
3. 判断依据：`chunk_hash` 与当前代码块内容的哈希值比较

## 提示词模板

默认提示词模板位于 `ChunkSummarizer.buildPrompt()` 方法中，格式如下：

```
请为以下代码块生成一段简洁的中文说明（2-3句话）：

文件路径: xxx
语言: go
类型: 函数
名称: main.MyFunc
导出: 是

代码:
```go
func MyFunc() { ... }
```

要求:
1. 用中文描述这个函数的功能和用途
2. 如果有重要参数或返回值，简要说明
3. 如果有特殊逻辑或注意事项，简要提及
4. 保持在3行以内，不超过150字
5. 不要包含代码，只输出文字说明
```

可根据需求自定义修改。

## 示例输出

```
Starting summarization...
[1/150] struct main.ShellCommand
[2/150] field main.ShellCommand.Shell
[3/150] function main.ExecuteShell
...

Summarization complete!
  Successful: 148
  Failed: 2
  Total tokens: 12500

Failed symbols:
  Symbol 42: API error: 429 Too Many Requests
  Symbol 89: API error: timeout
```

## 注意事项

1. **API 费用**：根据符号数量和代码复杂度，可能产生较多 token 消耗
2. **速率限制**：建议设置合理的并发数，避免触发 API 限流
3. **网络超时**：对于大型项目，建议分批处理
4. **数据备份**：首次运行前建议备份数据库

## 故障排查

### 所有请求都失败
- 检查 API 密钥是否正确
- 检查网络连接
- 检查 API 端点 URL

### 部分请求失败
- 查看错误日志定位原因
- 使用 `--concurrency 1` 降低并发
- 增加 `maxRetries` 重试次数

### 摘要质量不佳
- 调整提示词模板
- 尝试更强大的模型（如 gpt-4）
- 为不同语言定制不同提示词

