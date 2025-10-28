# CodeIndex AST Demo - 项目说明

## 目标
- 使用 Tree-sitter 为多语言（TypeScript/JavaScript、Go、Python）构建高性能代码索引库。
- 支持符号提取、调用链分析、对象/结构体/接口的属性与方法查询。
- 提供 Node.js API 与 CLI 两种使用方式，支持增量索引与全量重建。

## 核心能力
- 解析：基于 Tree-sitter，按语言适配提取语义元素
- 符号（Symbols）：function、method、class/interface/struct、variable、constant、property/field、type、module/namespace
- 关系（Calls）：函数/方法之间的调用（正向/反向，支持 depth 限制）
- 属性（Properties）：
  - TS/JS：类的属性/方法
  - Go：struct 的字段/方法、interface 的方法
  - Python：类的属性/方法（含 @property）
- 存储：SQLite（better-sqlite3）
- 索引：内容哈希 + mtime 增量；支持全量重建并 VACUUM 优化
- 输出：CLI 文本（含树形调用链美化）与 JSON

## 架构组件
- `parser/`：Tree-sitter 封装与语法加载、语言识别
- `extractor/`：按语言的提取器（ts/js、go、python）
- `indexer/`：文件扫描 → 解析 → 提取 → 入库
- `storage/`：SQLite 模型与访问层
- `query/`：查询引擎（符号查找、属性、调用链）
- `cli/`：命令行工具

## 数据模型（SQLite）
- `files(file_id, path, language, content_hash, mtime, size)`
- `symbols(symbol_id, file_id, language, kind, name, qualified_name, start_line, start_col, end_line, end_col, signature, exported)`
- `calls(call_id, caller_symbol_id, callee_symbol_id, site_file_id, site_start_line, site_start_col, site_end_line, site_end_col)`
- `symbol_references(ref_id, from_file_id, from_start_line, from_start_col, from_end_line, from_end_col, to_symbol_id, ref_kind)`

## CLI 概览
- `index`：索引项目（root、db、include/exclude、lang）
- `rebuild`：清空并重建索引（含 VACUUM）
- `symbol <name>`：按名称查找符号
- `properties <objectName>`：查看类/结构体/接口的属性/方法
- `call-chain --from <id> [--direction forward|backward] [--depth N] [--pretty|--json]`：生成调用链

## Node API（CodeIndex）
- `create({ rootDir, dbPath, languages, include?, exclude? })`
- `rebuild()`、`reindexAll()`
- `findSymbol()`、`findSymbols()`
- `objectProperties({ object, language? })`
- `callChain({ from, direction?, depth? })`
- `definition()`、`references()`、`close()`

## 设计与表现
- 增量索引：文件内容哈希 + mtime，对变更最小化处理
- 调用链：默认 `depth=5`，可前向/后向遍历，CLI 提供树形美化输出
- 合理的 `qualifiedName` 约定：如 `main.CreateUser`（Go）、`UserService.add_user`（Python）

## 文档导航
- 语言支持与测试覆盖：`@docs/language-support.md`
- 快速开始：`@docs/quickstart.md`

