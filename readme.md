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
- CLI：`init`/`index`/`rebuild`/`symbol`/`properties`/`call-chain`。

### 架构概览
- `parser/`：Tree‑sitter 封装与语法加载、语言识别。
- `extractor/`：按语言提取符号、调用、引用、对象属性等。
- `indexer/`：文件扫描 → 解析 → 提取 → 入库（增量）。
- `storage/`：SQLite 存储与访问（better‑sqlite3）。
- `query/`：查询引擎（符号/属性/调用链/引用）。
- `cli/`：命令行工具。

### 数据模型（SQLite）
- `files(file_id, path, language, content_hash, mtime, size, indexed_at)`
- `symbols(symbol_id, file_id, language, kind, name, qualified_name, start_line, start_col, end_line, end_col, signature, exported)`
- `calls(call_id, caller_symbol_id, callee_symbol_id, site_file_id, site_start_line, site_start_col, site_end_line, site_end_col)`
- `symbol_references(ref_id, from_file_id, from_start_line, from_start_col, from_end_line, from_end_col, to_symbol_id, ref_kind)`

> 规划中的“分块注释”：复用 `symbols` 作为块表，仅在 `symbols` 上新增列 `summary_md TEXT` 用于存储 LLM 生成的块注释（Markdown）。必要时可再加入 `chunk_hash`, `generated_at`, `model` 等元数据以减少重复生成并追踪来源。

### 分块与注释（设计与路线）
1) **块定义**：将每条 `symbols` 记录视为一个块（函数/方法/类/接口/结构体…）。
2) **生成流程**：
   - 索引完成后，查询 `summary_md IS NULL` 的符号记录；
   - 按 `(file.path, start_line..end_line)` 切片源码，组织提示词；
   - 调用 LLM 生成结构化 Markdown 注释（功能、参数/返回值、前置条件、副作用、错误/边界、调用摘要等）；
   - `UPDATE symbols SET summary_md=? WHERE symbol_id=?` 回填入库；
   - 文件变更会导致同文件符号重建，注释自然失效并重算（MVP 即可接受）。
3) **CLI 提案**：新增 `annotate` 子命令或为 `index` 增加 `--annotate`，支持并发、失败重试、速率限制、断点续跑。
4) **可选增强**：
   - 对切片做 `chunk_hash`，注释仅在哈希变化时重算；
   - 生成多粒度注释（块级、文件级、模块级）；
   - 向量库对接（OpenAI/FAISS/pgvector），用于召回与重排。

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
npx codeindex init
# 生成 codeindex.config.json，可按需修改
```

### 索引项目
```sh
npx codeindex index \
  --root . \
  --db .codeindex/sqlite.db \
  --lang ts js go python \
  --include "**/*" \
  --exclude "**/node_modules/**" "**/dist/**" "**/.git/**" \
  --max-nested-depth 3
```

### 查询符号
```sh
npx codeindex symbol CreateUser --lang go --json --db .codeindex/sqlite.db
```

### 查看对象/结构体/接口的属性与方法
```sh
npx codeindex properties UserService --lang ts --db .codeindex/sqlite.db
```

### 生成调用链
```sh
npx codeindex call-chain --from 123 --direction forward --depth 5 --pretty --db .codeindex/sqlite.db
```

> 更多说明参见 `@docs/quickstart.md` 与 `@docs/language-support.md`。

## 项目结构
- `src/parser/`：Tree‑sitter 适配与语言识别
- `src/extractor/`：语言级语义提取（TS/JS、Go、Python）
- `src/indexer/`：文件扫描、解析、入库
- `src/storage/`：SQLite 访问层
- `src/query/`：查询引擎
- `src/cli/`：命令行入口
- `examples/`：演示与自检用例
- `docs/`：项目文档

## 路线图
- 分块注释：在 `symbols` 新增 `summary_md` 字段，提供 `annotate` 命令（并发/断点续跑）。
- 内容签名：引入 `chunk_hash`/`generated_at`/`model` 元数据，避免重复生成。
- 向量检索：为注释与/或源码生成 Embedding，支持向量召回 + 语义重排。
- 引用完善：补全 `references()` 的 path/位置反查与跨文件引用质量。
- 语言扩展：Java/Rust 等；Go 接口实现/方法集更强支持。
- 监控与可视化：Web UI 展示调用链、类图、块注释与引用图谱。
- 监听与增量：文件更改监听与最小化重建。

## 许可证
MIT

---

如果你也在做“让 LLM 更懂代码”的事情，欢迎一起交流与共建。


