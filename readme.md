## CodeIndex AST Demo

让大模型精准理解代码的索引与上下文系统：基于 Tree‑sitter 构建跨语言 AST 索引，生成可查询的符号、调用关系与对象属性；下一步将把代码按“块”切分，并用 LLM 为每个块生成高质量注释，作为入库与检索的核心上下文。

### 愿景 / 构想
- **精准上下文**：面向代码智能体（Code Bot / Copilot / RAG），提供高置信度的、可验证的上下文来源。
- **结构化索引**：不仅有“全文”，更有“语义结构”——函数、方法、类/接口/结构体、变量、属性、调用链与引用关系。
- **分块 + 注释**：将代码细分为大量语义块（一个函数/方法/类/接口/结构体 = 一个块），用 LLM 为每个块生成 Markdown 注释，入库后可用于高质量检索与回答。

### 当前状态（MVP）
- 语言：TypeScript/JavaScript、Go、Python（基于 Tree‑sitter）。
- 索引：扫描文件 → AST 提取 → 入库（SQLite）。按内容哈希与 mtime 做增量。
- 符号：function、method、class/interface/struct、variable、constant、property/field、type、module/namespace。
- 关系：函数/方法之间的调用（正向/反向，支持深度），基础引用追踪（symbol_references）。
- 查询：按名称找符号、对象属性/方法、调用链生成（JSON/Pretty）。
- **AI 摘要**：LLM 自动为每个符号生成中文说明，增量更新（基于 chunk_hash），支持并发与重试。
- CLI：`init`/`index`/`rebuild`/`symbol`/`properties`/`call-chain`/`summarize`，所有命令支持配置文件与进度条。

### 架构概览
- `parser/`：Tree‑sitter 封装与语法加载、语言识别。
- `extractor/`：按语言提取符号、调用、引用、对象属性等。
- `indexer/`：文件扫描 → 解析 → 提取 → 入库（增量）。
- `storage/`：SQLite 存储与访问（better‑sqlite3，WAL 模式）。
- `query/`：查询引擎（符号/属性/调用链/引用）。
- `summarizer/`：LLM 驱动的代码块摘要生成（OpenAI 兼容 API）。
- `cli/`：命令行工具（支持配置文件、进度条）。

### 数据模型（SQLite）
- `files(file_id, path, language, content_hash, mtime, size, indexed_at)`
- `symbols(symbol_id, file_id, language, kind, name, qualified_name, start_line, start_col, end_line, end_col, signature, exported, chunk_hash, chunk_summary, summary_tokens, summarized_at)`
- `calls(call_id, caller_symbol_id, callee_symbol_id, site_file_id, site_start_line, site_start_col, site_end_line, site_end_col)`
- `symbol_references(ref_id, from_file_id, from_start_line, from_start_col, from_end_line, from_end_col, to_symbol_id, ref_kind)`

> **已实现**：`symbols` 表新增 `chunk_hash`（代码块哈希）、`chunk_summary`（LLM 生成的摘要）、`summary_tokens`（token 消耗）、`summarized_at`（生成时间戳），支持增量更新与成本追踪。

### 分块与注释（已实现 MVP）
1) **块定义**：将每条 `symbols` 记录视为一个块（函数/方法/类/接口/结构体…）。
2) **生成流程**：
   - 索引完成后，运行 `summarize` 命令查询 `chunk_summary IS NULL` 的符号；
   - 按 `(file.path, start_line..end_line)` 切片源码，组织提示词；
   - 调用 LLM（OpenAI 兼容 API）生成中文摘要（功能、参数/返回值、注意事项）；
   - 计算 `chunk_hash`，更新 `symbols` 表（`chunk_hash`, `chunk_summary`, `summary_tokens`, `summarized_at`）；
   - 文件变更会导致同文件符号重建，`chunk_hash` 变化时自动重新生成摘要。
3) **CLI 命令**：`summarize` 子命令，支持：
   - 配置文件驱动（API 端点/密钥/模型/并发/重试）
   - 进度条显示
   - 并发控制与指数退避重试
   - Token 使用统计
4) **下一步增强**：
   - 生成多粒度注释（文件级、模块级）
   - 向量库对接（OpenAI/FAISS/pgvector），用于语义召回与重排
   - 提示词模板定制

### 约定与最佳实践
- `qualified_name`：以“可唯一定位 + 可阅读”为目标，示例：
  - Go：`package.Struct.Method` 或 `package.(*Struct).Method`
  - Python：`module.Class.method`
  - TS/JS：`Module.Class.method` / `fileSymbol`
- 调用链：默认 `depth=5`，支持 `forward/backward`。
- 增量：相同 `content_hash` 的文件跳过重索引。

## 快速开始

### 环境要求
- Node.js 18+

### 安装与构建
```sh
npm install
npm run build
```

### 初始化配置
```sh
node dist/cli/index.js init
# 生成 codeindex.config.json，可按需修改
```

这会创建默认配置文件：
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

### 索引项目

**方式一：使用配置文件（推荐）**

修改 `codeindex.config.json` 后直接运行：
```sh
node dist/cli/index.js index
# 自动读取配置文件，显示进度条
```

**方式二：命令行参数**

```sh
node dist/cli/index.js index \
  --root . \
  --db .codeindex/sqlite.db \
  --lang go \
  --include "**/*.go" \
  --exclude "**/vendor/**" "**/.git/**" \
  --max-nested-depth 5
```

### 生成 AI 摘要

修改配置文件中的 `summarizer` 部分（填写 API key），然后运行：
```sh
node dist/cli/index.js summarize
# 为所有符号生成中文摘要，显示进度条
```

或使用命令行参数：
```sh
node dist/cli/index.js summarize \
  --api-endpoint https://api.openai.com/v1/chat/completions \
  --api-key your-api-key \
  --model gpt-4o-mini
```

### 查询符号
```sh
node dist/cli/index.js symbol CreateUser --lang go --json
```

### 查看对象/结构体/接口的属性与方法
```sh
node dist/cli/index.js properties UserService --lang go
```

### 生成调用链
```sh
node dist/cli/index.js call-chain --from 123 --direction forward --depth 5 --pretty
```

> **提示**：所有命令都支持 `--config` 指定配置文件路径（默认 `codeindex.config.json`），CLI 参数会覆盖配置值。

> 更多说明参见 `docs/summarizer-usage.md`、`docs/quickstart.md` 与 `docs/language-support.md`。

## 项目结构
- `src/parser/`：Tree‑sitter 适配与语言识别
- `src/extractor/`：语言级语义提取（TS/JS、Go、Python）
- `src/indexer/`：文件扫描、解析、入库
- `src/storage/`：SQLite 访问层（schema 自动迁移）
- `src/query/`：查询引擎
- `src/summarizer/`：LLM 驱动的摘要生成
- `src/cli/`：命令行入口（配置文件 + 进度条）
- `examples/`：演示与自检用例
- `docs/`：项目文档（含 summarizer-usage.md）

## 路线图

### ✅ 已完成
- ✅ 分块注释：`symbols` 新增 `chunk_hash`/`chunk_summary`/`summary_tokens`/`summarized_at`，提供 `summarize` 命令
- ✅ 增量摘要：基于 `chunk_hash` 避免重复生成，支持并发与重试
- ✅ 配置文件：所有命令支持 `codeindex.config.json`，CLI 参数可覆盖
- ✅ 进度条：`index`/`rebuild`/`summarize` 显示实时进度
- ✅ Schema 迁移：数据库自动检测并添加新列

### 🚧 进行中 / 计划中
- 向量检索：为摘要与/或源码生成 Embedding，支持向量召回 + 语义重排
- 引用完善：补全 `references()` 的 path/位置反查与跨文件引用质量
- 语言扩展：Java/Rust 等；Go 接口实现/方法集更强支持
- 提示词定制：支持自定义提示词模板文件，为不同语言/符号类型定制
- 监控与可视化：Web UI 展示调用链、类图、块注释与引用图谱
- 监听与增量：文件更改监听与最小化重建
- 质量评估：摘要质量评分与反馈机制

## 许可证
MIT

---

如果你也在做“让 LLM 更懂代码”的事情，欢迎一起交流与共建。


